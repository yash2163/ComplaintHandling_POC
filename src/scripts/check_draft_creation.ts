
import { OutlookService } from '../services/outlook';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('Starting Outlook Draft Creation Check...');

    // Check for target mailbox
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL;
    if (!targetEmail) {
        console.error('Error: TARGET_MAILBOX_EMAIL env var is not set.');
        process.exit(1);
    }

    console.log(`Target Mailbox: ${targetEmail}`);

    const outlook = new OutlookService();
    const authenticated = await outlook.authenticate();

    if (!authenticated) {
        console.error('Authentication failed.');
        process.exit(1);
    }
    console.log('Authentication successful.');

    try {
        console.log('Attempting to create draft...');
        const draft = await outlook.createDraft(
            targetEmail,
            'Test Draft from Anti-Gravity Agent',
            'This is a test draft created to verify permissions and functionality.'
        );
        console.log('Draft created successfully!');
        console.log('Draft ID:', draft.id);
        console.log('Draft Subject:', draft.subject);
    } catch (error: any) {
        console.error('Failed to create draft.');
        console.error('Error Message:', error.message);
        if (error.statusCode === 403) {
            console.error('Permission Denied. The app likely needs "Mail.ReadWrite" application permissions.');
        }
    }
}

main();
