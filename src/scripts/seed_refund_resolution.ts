import prisma from '../services/db';
import { OutlookService } from '../services/outlook';
import dotenv from 'dotenv';
dotenv.config();

async function seedRefundResolution() {
    console.log('Seeding POSITIVE Resolution for Medical Refund (ABC123)...');

    // 1. Find the target complaint
    const pnr = 'ABC123';
    const complaint = await prisma.complaint.findFirst({
        where: { pnr: pnr }
    });

    if (!complaint) {
        console.error(`Complaint for PNR ${pnr} not found! Run the main seed script first.`);
        return;
    }

    console.log(`Target Complaint ID: ${complaint.id}`);

    // 2. Inject "Approved" Email into Resolutions Folder
    const outlook = new OutlookService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL;
    if (!targetEmail) throw new Error("TARGET_MAILBOX_EMAIL not set");

    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');
    if (!resolutionsFolderId) throw new Error("Resolutions folder not found");

    console.log(`Injecting Resolution Email into folder ${resolutionsFolderId}...`);

    const resolutionSubject = `[Case: ${complaint.id}] Re: Urgent Medical Refund Request - PNR: ABC123`;
    const resolutionBody = `
    Dear CX Team,

    We have reviewed the medical documents provided for passenger John Doe (PNR: ABC123).
    The request falls under our medical emergency waiver policy.
    
    Action Taken:
    - Full refund of INR 12,500 has been initiated to the original payment source.
    - Cancellation charges waived.
    
    Please inform the passenger accordingly.

    Regards,
    Refunds Department
    `;

    await outlook.createMessageInFolder(targetEmail, resolutionsFolderId, resolutionSubject, resolutionBody);

    console.log('Positive Resolution email injected successfully.');
    console.log('---------------------------------------------------');
    console.log('The worker should now mark this case as RESOLVED.');
}

seedRefundResolution().catch(console.error).finally(() => prisma.$disconnect());
