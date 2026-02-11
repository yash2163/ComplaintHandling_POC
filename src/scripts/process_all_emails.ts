import { OutlookService } from '../services/outlook';
import { AgentService } from '../services/agent';
import prisma from '../services/db';
import dotenv from 'dotenv';

dotenv.config();

async function processAllEmails() {
    const targetEmail = process.env.TARGET_EMAIL_ADDRESS;
    if (!targetEmail) {
        console.error('TARGET_EMAIL_ADDRESS not set');
        return;
    }

    const outlook = new OutlookService(
        process.env.AZURE_CLIENT_ID!,
        process.env.AZURE_CLIENT_SECRET!,
        process.env.AZURE_TENANT_ID!
    );

    const agent = new AgentService();

    console.log('🔍 Finding Complaints and Resolutions folders...\n');

    const complaintsFolderId = await outlook.findFolderByName(targetEmail, 'Complaints');
    const resolutionsFolderId = await outlook.findFolderByName(targetEmail, 'Resolutions');

    if (!complaintsFolderId || !resolutionsFolderId) {
        console.error('Could not find required folders!');
        return;
    }

    // Process Complaints
    console.log('📥 Processing Complaints folder...');
    const complaintEmails = await outlook.getUnreadMessages(targetEmail, complaintsFolderId);
    console.log(`Found ${complaintEmails.length} unread complaint emails\n`);

    for (const email of complaintEmails) {
        console.log(`  ✉️  Processing: ${email.subject}`);

        // Check if already processed
        const existing = await prisma.complaint.findUnique({
            where: { originalEmailId: email.id }
        });

        if (existing) {
            console.log('     ⏭️  Already processed, skipping\n');
            continue;
        }

        // Classify
        const isComplaint = await agent.isAirlineComplaint(email.subject, email.body);
        if (!isComplaint) {
            console.log('     ❌ Not a valid complaint, skipping\n');
            continue;
        }

        // Extract
        const { grid, confidence } = await agent.extractInvestigationGrid({
            subject: email.subject,
            body: email.body,
            receivedAt: email.receivedDateTime
        });

        // Create complaint
        const complaint = await prisma.complaint.create({
            data: {
                originalEmailId: email.id,
                subject: email.subject,
                status: grid.pnr ? 'WAITING_OPS' : 'MISSING_INFO',
                pnr: grid.pnr,
                customerName: grid.customer_name,
                flightNumber: grid.flight_number,
                source: grid.source,
                destination: grid.destination,
                originStation: grid.origin_station,
                complaintDetail: grid.complaint,
                conversation: {
                    create: [
                        {
                            authorType: 'CUSTOMER',
                            messageType: 'EMAIL',
                            content: {
                                subject: email.subject,
                                body: email.body,
                                receivedAt: email.receivedDateTime.toISOString()
                            }
                        },
                        {
                            authorType: 'AGENT_1',
                            messageType: 'GRID',
                            content: {
                                gridFields: grid,
                                confidence: confidence
                            }
                        }
                    ]
                }
            }
        });

        console.log(`     ✅ Created complaint: ${complaint.id}\n`);
    }

    // Process Resolutions
    console.log('\n🔧 Processing Resolutions folder...');
    const resolutionEmails = await outlook.getUnreadMessages(targetEmail, resolutionsFolderId);
    console.log(`Found ${resolutionEmails.length} unread resolution emails\n`);

    for (const email of resolutionEmails) {
        console.log(`  ✉️  Processing: ${email.subject}`);

        // Extract complaint ID from subject
        const match = email.subject.match(/\[Case:\s*([a-f0-9-]+)\]/i);
        if (!match) {
            console.log('     ⚠️  No Case ID found in subject, skipping\n');
            continue;
        }

        const complaintId = match[1];
        const complaint = await prisma.complaint.findUnique({
            where: { id: complaintId },
            include: { conversation: true }
        });

        if (!complaint) {
            console.log(`     ❌ Complaint ${complaintId} not found\n`);
            continue;
        }

        // Get original email
        const emailMsg = complaint.conversation.find(m => m.messageType === 'EMAIL');
        const originalBody = (emailMsg?.content as any)?.body || '';

        // Evaluate resolution
        const evaluation = await agent.evaluateResolution(
            { subject: complaint.subject, body: originalBody },
            { subject: email.subject, body: email.body }
        );

        // Update complaint
        const newStatus = evaluation.status === 'RESOLVED' ? 'RESOLVED' : 'FLAGGED';
        const mainStatus = newStatus === 'RESOLVED' ? 'RESOLVED' : 'WAITING_OPS';

        await prisma.complaint.update({
            where: { id: complaintId },
            data: {
                resolutionStatus: newStatus,
                agentReasoning: evaluation.reasoning,
                resolutionSummary: evaluation.summary,
                resolutionAction: evaluation.action_taken,
                resolutionOutcome: evaluation.outcome,
                status: mainStatus
            }
        });

        console.log(`     ✅ Resolution: ${evaluation.status}`);
        console.log(`        Action: ${evaluation.action_taken}`);
        console.log(`        Outcome: ${evaluation.outcome}\n`);
    }

    console.log('✅ All emails processed!');
}

processAllEmails()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
