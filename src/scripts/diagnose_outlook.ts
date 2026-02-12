import { OutlookService } from '../services/outlook';
import dotenv from 'dotenv';
dotenv.config();

async function diagnose() {
    const outlook = new OutlookService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL!;

    console.log(`Checking mailbox: ${targetEmail}`);

    const resId = await outlook.getFolderId(targetEmail, 'Resolutions');
    console.log(`Resolutions Folder ID: ${resId}`);

    if (!resId) return;

    try {
        const resEmails = await outlook.getEmailsFromFolder(targetEmail, resId!, 5);
        console.log(`\n--- Resolutions Folder (last 5) ---`);
        console.log(`Found ${resEmails.length} emails.`);
        resEmails.forEach(e => {
            console.log(`[${e.receivedDateTime}] ${e.subject}`);
            console.log(`   BodyLen: ${e.body?.content?.length}`);
            console.log(`   Preview: ${e.bodyPreview?.substring(0, 50)}...`);
        });
    } catch (err) {
        console.error("Error fetching from folder:", err);
    }
}

diagnose().catch(console.error);
