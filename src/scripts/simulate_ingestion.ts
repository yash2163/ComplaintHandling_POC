import { OutlookService } from '../services/outlook';
import dotenv from 'dotenv';
dotenv.config();

async function simulateIngestion() {
    const outlook = new OutlookService();
    await outlook.authenticate();

    const targetEmail = process.env.TARGET_MAILBOX_EMAIL;
    if (!targetEmail) throw new Error("TARGET_MAILBOX_EMAIL not set");

    // Get Complaints Folder
    const complaintsFolderId = await outlook.getFolderId(targetEmail, 'Complaints');
    if (!complaintsFolderId) throw new Error("Complaints folder not found");

    console.log(`Injecting test complaint into folder: ${complaintsFolderId}`);

    const subject = "Urgent: Missing Baggage on Flight 6E-555";
    const body = `
    Hi Indigo Team,
    
    I am writing to report my missing baggage. 
    Flight: 6E-555
    Date: 2026-03-03
    Origin: BOM
    
    My bag did not arrive on the belt. Please assist immediately.
    
    Regards,
    Test Passenger
    `;

    await outlook.createMessageInFolder(targetEmail, complaintsFolderId, subject, body);
    console.log("Comlaint injected successfully!");
}

simulateIngestion().catch(console.error);
