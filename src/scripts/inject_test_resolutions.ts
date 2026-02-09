import { OutlookService } from '../services/outlook';
import prisma from '../services/db';
import dotenv from 'dotenv';
dotenv.config();

async function injectTestResolutions() {
    const outlook = new OutlookService();
    await outlook.authenticate();

    const targetEmail = process.env.TARGET_MAILBOX_EMAIL;
    if (!targetEmail) throw new Error("TARGET_MAILBOX_EMAIL not set");

    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');
    if (!resolutionsFolderId) throw new Error("Resolutions folder not found");

    // 1. Correct Resolution for 6E-101 (Damaged Baggage)
    const c1 = await prisma.complaint.findFirst({
        where: { subject: { contains: '6E-101' } }
    });
    if (c1) {
        const subject = `RE: [Case: ${c1.id}] Baggage Damage - Flight 6E-101`;
        const body = `
        Case Resolved. 
        We have verified the damage and authorized a compensation of INR 3000.
        The amount will be credited to your account within 5-7 business days.
        `;
        console.log(`Injecting CORRECT resolution for Case ${c1.id}`);
        await outlook.createMessageInFolder(targetEmail, resolutionsFolderId, subject, body);
    } else {
        console.log("Complaint for 6E-101 not found yet. Run ingestion first.");
    }

    // 2. Incorrect/Partial Resolution for 6E-202 (Refund Request)
    const c2 = await prisma.complaint.findFirst({
        where: { subject: { contains: '6E-202' } }
    });
    if (c2) {
        const subject = `RE: [Case: ${c2.id}] Refund Request: Cancelled Flight 6E-202`;
        const body = `
        Hello, we are looking into your request. Please wait.
        `;
        console.log(`Injecting INCORRECT (incomplete) resolution for Case ${c2.id}`);
        await outlook.createMessageInFolder(targetEmail, resolutionsFolderId, subject, body);
    } else {
        console.log("Complaint for 6E-202 not found yet. Run ingestion first.");
    }

    console.log("Resolutions injection attempt completed!");
}

injectTestResolutions().catch(console.error);
