// Main worker service for GCP deployment
// Polls two Outlook folders and processes complaints and resolutions separately

import { OutlookServiceGCP } from '../services/outlook-gcp';
import { Agent1ComplaintClassifier } from '../services/agent1-classifier';
import { Agent2ResolutionEvaluator } from '../services/agent2-evaluator';
import { FirestoreService } from '../services/firestore';
import { ComplaintIdService } from '../utils/complaint-id';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import dotenv from 'dotenv';

dotenv.config();

const POLL_INTERVAL_MS = 60000; // 60 seconds

export class ComplaintWorker {
    private outlookService!: OutlookServiceGCP;
    private agent1!: Agent1ComplaintClassifier;
    private agent2!: Agent2ResolutionEvaluator;
    private firestoreService!: FirestoreService;
    private complaintIdService!: ComplaintIdService;
    private projectId: string;

    constructor(projectId: string) {
        this.projectId = projectId;
    }

    /**
     * Initialize services with credentials from Secret Manager
     */
    async initialize(): Promise<void> {
        console.log('🔧 Initializing Complaint Worker...');

        // Get secrets from Secret Manager (or env vars for local development)
        const azureTenantId = await this.getSecret('azure-tenant') || process.env.AZURE_TENANT_ID!;
        const azureClientId = await this.getSecret('azure-client') || process.env.AZURE_CLIENT_ID!;
        const azureClientSecret = await this.getSecret('azure-secret') || process.env.AZURE_CLIENT_SECRET!;
        const targetEmail = await this.getSecret('target-email') || process.env.TARGET_MAILBOX_EMAIL!;

        // Initialize services
        this.outlookService = new OutlookServiceGCP(
            azureTenantId,
            azureClientId,
            azureClientSecret,
            targetEmail
        );

        this.agent1 = new Agent1ComplaintClassifier(this.projectId);
        this.agent2 = new Agent2ResolutionEvaluator(this.projectId);
        this.firestoreService = new FirestoreService(this.projectId);
        this.complaintIdService = new ComplaintIdService(this.projectId);

        // Test Outlook connection
        const connected = await this.outlookService.testConnection();
        if (!connected) {
            throw new Error('Failed to connect to Outlook');
        }

        console.log('✅ Worker initialized successfully');
    }

    /**
     * Get secret from Secret Manager
     */
    private async getSecret(secretName: string): Promise<string | null> {
        try {
            const client = new SecretManagerServiceClient();
            const name = `projects/${this.projectId}/secrets/${secretName}/versions/latest`;
            const [version] = await client.accessSecretVersion({ name });
            return version.payload?.data?.toString() || null;
        } catch (error) {
            console.warn(`Could not fetch secret ${secretName}, using env var`);
            return null;
        }
    }

    /**
     * Process complaint emails (triggers Agent 1)
     */
    private async processComplaints(): Promise<void> {
        try {
            console.log('📧 Fetching complaint emails...');
            const emails = await this.outlookService.fetchComplaintEmails(20);

            console.log(`Found ${emails.length} unread complaint emails`);

            for (const email of emails) {
                try {
                    // Check if already processed
                    const alreadyProcessed = await this.firestoreService.checkEmailProcessed(email.id);
                    if (alreadyProcessed) {
                        console.log(`⏭️  Email ${email.id} already processed, skipping`);
                        await this.outlookService.markAsRead(email.id);
                        continue;
                    }

                    // Classify email
                    const isComplaint = await this.agent1.isAirlineComplaint(email.subject, email.body);
                    if (!isComplaint) {
                        console.log(`⏭️  Email "${email.subject}" is not a complaint, skipping`);
                        await this.outlookService.markAsRead(email.id);
                        continue;
                    }

                    console.log(`✅ Processing complaint: "${email.subject}"`);

                    // Generate complaint ID
                    const complaintId = await this.complaintIdService.generateComplaintId();
                    console.log(`🆔 Generated ID: ${complaintId}`);

                    // Extract investigation grid using Agent 1
                    const { grid, confidence } = await this.agent1.extractInvestigationGrid({
                        subject: email.subject,
                        body: email.body,
                        receivedAt: email.receivedDateTime
                    });

                    // Store in Firestore
                    await this.firestoreService.createComplaint({
                        id: complaintId,
                        originalEmailId: email.id,
                        subject: email.subject,
                        senderEmail: email.from.email,
                        senderName: email.from.name,
                        receivedAt: email.receivedDateTime,
                        investigationGrid: grid,
                        status: 'NEW',
                        resolutionStatus: 'PENDING'
                    });

                    console.log(`💾 Stored complaint ${complaintId} in Firestore`);

                    // Mark as read
                    await this.outlookService.markAsRead(email.id);

                    console.log(`✅ Successfully processed complaint ${complaintId}`);
                } catch (error) {
                    console.error(`❌ Error processing email ${email.id}:`, error);
                    // Continue to next email
                }
            }
        } catch (error) {
            console.error('❌ Error in processComplaints:', error);
        }
    }

    /**
     * Process resolution emails (triggers Agent 2)
     */
    private async processResolutions(): Promise<void> {
        try {
            console.log('📧 Fetching resolution emails...');
            const emails = await this.outlookService.fetchResolutionEmails(20);

            console.log(`Found ${emails.length} unread resolution emails`);

            for (const email of emails) {
                try {
                    // Check if already processed
                    const alreadyProcessed = await this.firestoreService.checkEmailProcessed(email.id);
                    if (alreadyProcessed) {
                        console.log(`⏭️  Email ${email.id} already processed, skipping`);
                        await this.outlookService.markAsRead(email.id);
                        continue;
                    }

                    // Extract complaint ID from subject or body
                    const complaintId = this.complaintIdService.extractComplaintId(
                        email.subject + ' ' + email.body
                    );

                    if (!complaintId) {
                        console.log(`⚠️  Could not find complaint ID in resolution email "${email.subject}"`);
                        await this.outlookService.markAsRead(email.id);
                        continue;
                    }

                    console.log(`✅ Processing resolution for complaint: ${complaintId}`);

                    // Fetch original complaint
                    const complaint = await this.firestoreService.getComplaint(complaintId);
                    if (!complaint) {
                        console.log(`⚠️  Complaint ${complaintId} not found in database`);
                        await this.outlookService.markAsRead(email.id);
                        continue;
                    }

                    // Evaluate resolution using Agent 2
                    const evaluation = await this.agent2.evaluateResolution(complaint, {
                        subject: email.subject,
                        body: email.body,
                        senderEmail: email.from.email,
                        senderName: email.from.name,
                        receivedAt: email.receivedDateTime
                    });

                    // Store resolution in Firestore
                    await this.firestoreService.createResolution({
                        complaintId: complaintId,
                        originalEmailId: email.id,
                        subject: email.subject,
                        sender Email: email.from.email,
                        senderName: email.from.name,
                        receivedAt: email.receivedDateTime,
                        resolutionText: email.body,
                        evaluation: {
                            status: evaluation.status,
                            reasoning: evaluation.reasoning,
                            summary: evaluation.summary,
                            confidence: evaluation.confidence
                        },
                        draftResponse: evaluation.draftResponse
                    });

                    // Update complaint status
                    const newStatus = evaluation.status === 'RESOLVED' ? 'RESOLVED' : 'PROCESSING';
                    await this.firestoreService.updateComplaintStatus(
                        complaintId,
                        newStatus,
                        evaluation.status === 'RESOLVED' ? 'RESOLVED' : 'FLAGGED'
                    );

                    console.log(`💾 Stored resolution for ${complaintId}, status: ${evaluation.status}`);

                    // Mark as read
                    await this.outlookService.markAsRead(email.id);

                    console.log(`✅ Successfully processed resolution for ${complaintId}`);
                } catch (error) {
                    console.error(`❌ Error processing resolution email ${email.id}:`, error);
                    // Continue to next email
                }
            }
        } catch (error) {
            console.error('❌ Error in processResolutions:', error);
        }
    }

    /**
     * Main worker loop
     */
    async run(): Promise<void> {
        console.log('🚀 Starting Complaint Worker...');

        await this.initialize();

        console.log(`⏰ Polling every ${POLL_INTERVAL_MS / 1000} seconds`);

        // Run immediately on startup
        await this.processComplaints();
        await this.processResolutions();

        // Then run on interval
        setInterval(async () => {
            console.log('\n--- Polling cycle started ---');
            await this.processComplaints();
            await this.processResolutions();
            console.log('--- Polling cycle completed ---\n');
        }, POLL_INTERVAL_MS);
    }
}

// Main entry point
if (require.main === module) {
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
        console.error('❌ GCP_PROJECT_ID environment variable is required');
        process.exit(1);
    }

    const worker = new ComplaintWorker(projectId);
    worker.run().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}
