import { OutlookService } from '../services/outlook';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function debugResolution() {
    const outlook = new OutlookService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL!;
    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');

    console.log(`Searching in Resolutions folder of ${targetEmail}...`);

    const messages = await outlook.getEmailsFromFolder(targetEmail, resolutionsFolderId!, 20);

    // Look for the specific case ID
    const targetCaseId = '38066005-b21c-4e3a-9cda-7752de2a249e';
    const targetMsg = messages.find(m => m.subject.includes(targetCaseId));

    if (!targetMsg) {
        console.log(`❌ Message for Case ${targetCaseId} not found in recent 20 emails.`);
        console.log('Available subjects:');
        messages.forEach(m => console.log(` - ${m.subject}`));
        return;
    }

    console.log(`✅ Found Message: ${targetMsg.subject}`);
    console.log('--- BODY PREVIEW ---');
    console.log(targetMsg.bodyPreview);
    const fullBody = (targetMsg.body as any)?.content || 'No Body Content';
    console.log('--- FULL BODY CONTENT ---');
    console.log(fullBody.substring(0, 500) + '... (truncated in console, check file)');

    fs.writeFileSync('resolution_debug.txt', fullBody);
    console.log('✅ Saved full body to resolution_debug.txt');
    console.log('--- END BODY ---');

    // Test regex match
    const emailBody = (targetMsg.body as any)?.content || '';
    const gridMatch = emailBody.match(/=== INVESTIGATION GRID ===([\s\S]*?)=== END GRID ===/);
    if (!gridMatch) {
        console.log('❌ REGEX FAILED: Grid block not found in body.');
    } else {
        console.log('✅ REGEX SUCCESS: Grid block found.');
        console.log(gridMatch[1]);
    }
}

debugResolution().catch(console.error);
