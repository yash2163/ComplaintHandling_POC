import { OutlookService } from '../services/outlook';
import prisma from '../services/db';
import dotenv from 'dotenv';
dotenv.config();

async function simulateResolution() {
    // 1. Find the complaint
    const c = await prisma.complaint.findFirst({
        where: { subject: { contains: 'Missing Baggage' } }
    });
    if (!c) throw new Error("Complaint not found in DB");

    console.log(`Found Complaint ${c.id}`);

    // 2. Inject Resolution
    const outlook = new OutlookService();
    await outlook.authenticate();

    const targetEmail = process.env.TARGET_MAILBOX_EMAIL;
    if (!targetEmail) throw new Error("TARGET_MAILBOX_EMAIL not set");

    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');
    if (!resolutionsFolderId) throw new Error("Resolutions folder not found");

    const subject = `RE: [Case: ${c.id}] Urgent: Missing Baggage - Investigated`;
    const body = `
    Hi,

    We have located the passenger's baggage. Segregated at belt 4. 
    It has been delivered to their hotel. Refund for delay processed.

    Regards,
    Flight Crew
    `;

    console.log(`Injecting resolution for Case ${c.id}...`);
    await outlook.createMessageInFolder(targetEmail, resolutionsFolderId, subject, body);
    console.log("Resolution injected!");
}

simulateResolution().catch(console.error);
