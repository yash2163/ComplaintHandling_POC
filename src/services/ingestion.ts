import { OutlookService } from './outlook';
import { ClassifierService } from './classifier';
import { StorageService } from './storage';
import { NormalizedEmail, EmailType } from '../types/domain';

export class IngestionService {
    private outlook: OutlookService;
    private classifier: ClassifierService;
    private storage: StorageService;

    constructor() {
        this.outlook = new OutlookService();
        this.classifier = new ClassifierService();
        this.storage = new StorageService();
    }

    async init() {
        await this.outlook.authenticate();
        await this.storage.init();
        console.log('Ingestion Services Initialized');
    }

    async processCycle(targetEmail: string) {
        console.log(`Polling emails for ${targetEmail}...`);

        // Fetch last 10 emails (could be parameterized)
        const messages = await this.outlook.getRecentEmails(targetEmail, 10);

        let newCount = 0;
        for (const msg of messages) {
            // Check if already processed
            const existing = await this.storage.getRawEmail(msg.id);
            if (existing) {
                // Skip duplicates
                continue;
            }

            // Normalize
            const normalized = this.normalize(msg);

            // Classify
            normalized.classification = this.classifier.classify(normalized);

            // Save
            await this.storage.saveRawEmail(normalized);
            newCount++;

            console.log(`[Ingested] ${normalized.id} | ${normalized.classification} | ${normalized.subject}`);
        }

        if (newCount === 0) {
            console.log('No new emails found.');
        } else {
            console.log(`Ingested ${newCount} new emails.`);
        }
    }

    private normalize(msg: any): NormalizedEmail {
        return {
            id: msg.id,
            sourceId: msg.id,
            subject: msg.subject || '(No Subject)',
            sender: {
                email: msg.from?.emailAddress?.address || 'unknown',
                name: msg.from?.emailAddress?.name || null
            },
            recipients: (msg.toRecipients || []).map((r: any) => r.emailAddress?.address),
            body: msg.bodyPreview || '', // Using bodyPreview for POC efficiency
            receivedAt: new Date(msg.receivedDateTime),
            hasAttachments: msg.hasAttachments || false
        };
    }
}
