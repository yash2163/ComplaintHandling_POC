import { OutlookService } from '../services/outlook';
import dotenv from 'dotenv';

dotenv.config();

interface ValidationOutput {
    outlook_connection: string;
    emails_fetched: number;
    mailbox_verified: boolean;
    error?: string;
    metadata?: any;
}

async function validate() {
    const output: ValidationOutput = {
        outlook_connection: 'PENDING',
        emails_fetched: 0,
        mailbox_verified: false
    };

    const targetEmail = process.env.TARGET_MAILBOX_EMAIL;

    if (!targetEmail) {
        output.outlook_connection = 'FAILED';
        output.error = 'TARGET_MAILBOX_EMAIL not defined in .env';
        console.log(JSON.stringify(output, null, 2));
        process.exit(1);
        return;
    }

    console.error(`Validating connection for: ${targetEmail}...`); // Log to stderr to keep stdout clean for JSON

    const outlook = new OutlookService();

    try {
        // 1. Authenticate
        const authSuccess = await outlook.authenticate();
        if (!authSuccess) {
            output.outlook_connection = 'FAILED';
            output.error = 'Authentication initialization failed';
            console.log(JSON.stringify(output, null, 2));
            process.exit(1);
            return;
        }

        // 2. Fetch Metadata (proves access to the specific mailbox)
        const metadata = await outlook.getMailboxMetadata(targetEmail);
        output.mailbox_verified = !!metadata.id;
        output.metadata = { id: metadata.id, displayName: metadata.displayName };

        // 3. Fetch Recent Emails
        const emails = await outlook.getRecentEmails(targetEmail, 5);
        output.emails_fetched = emails.length;
        output.outlook_connection = 'SUCCESS';

        // Log email summaries to stderr for debugging
        emails.forEach(e => console.error(`[Email] ${e.receivedDateTime}: ${e.subject}`));

    } catch (error: any) {
        output.outlook_connection = 'FAILED';
        output.error = error.message || String(error);
    }

    console.log(JSON.stringify(output, null, 2));

    if (output.outlook_connection !== 'SUCCESS') {
        process.exit(1);
    }
}

validate();
