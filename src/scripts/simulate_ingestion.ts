/**
 * PURPOSE: Automatically drafts and sends a mock customer complaint email directly into the 'Complaints' Outlook folder via Microsoft Graph.
 * USAGE: npx ts-node src/scripts/simulate_ingestion.ts
 * WHEN TO USE: Run this to instantly test the Outlook Polling Worker without having to log into an email client yourself to draft a message.
 */
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

    // ==========================================
    // EDIT THESE VARIABLES TO TEST A NEW COMPLAINT
    // ==========================================
    const subject = "Urgent: Diverted Flight Chaos";
    const body = `
    Hi Indigo Team,
    
    My flight was diverted to another city last night due to bad weather. 
    We were left sitting at the airport for 12 hours without any hotel accommodation offered.
    
    This is unacceptable. I demand compensation for my hotel and meals.
    
    Regards,
    Test Passenger
    `;
    // ==========================================

    await outlook.createMessageInFolder(targetEmail, complaintsFolderId, subject, body);
    console.log("Comlaint injected successfully!");
}

simulateIngestion().catch(console.error);
