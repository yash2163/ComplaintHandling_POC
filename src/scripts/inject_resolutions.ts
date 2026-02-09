import { OutlookService } from '../services/outlook';
import dotenv from 'dotenv';
dotenv.config();

async function injectResolutions() {
    const outlook = new OutlookService();
    await outlook.authenticate();

    const targetEmail = process.env.TARGET_MAILBOX_EMAIL;
    if (!targetEmail) throw new Error("TARGET_MAILBOX_EMAIL not set");

    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');
    if (!resolutionsFolderId) throw new Error("Resolutions folder not found");

    const resolutions = [
        {
            subject: "[Case: 93dcc725-f155-4d58-9873-fae7495faf3c] Resolution for Medical Refund",
            body: "The medical documents have been verified. We have approved a full refund for PNR ABC123 as requested on medical grounds. The amount will be credited to the original form of payment within 7-10 business days."
        },
        {
            subject: "[Case: b33feb37-6623-4137-b1af-18f6d913e826] Response to Service Complaint",
            body: "We are sorry to hear about the broken seat. We have credited 500 INR to your Indigo wallet for the inconvenience caused by seat 15C. We hope you will fly with us again."
        }
    ];

    for (const r of resolutions) {
        console.log(`Injecting Resolution: ${r.subject}`);
        await outlook.createMessageInFolder(targetEmail, resolutionsFolderId, r.subject, r.body);
    }

    console.log('Resolutions injected.');
}

injectResolutions().catch(console.error);
