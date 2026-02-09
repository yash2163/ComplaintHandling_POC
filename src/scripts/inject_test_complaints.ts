import { OutlookService } from '../services/outlook';
import dotenv from 'dotenv';
dotenv.config();

async function injectTestComplaints() {
    const outlook = new OutlookService();
    await outlook.authenticate();

    const targetEmail = process.env.TARGET_MAILBOX_EMAIL;
    if (!targetEmail) throw new Error("TARGET_MAILBOX_EMAIL not set");

    const complaintsFolderId = await outlook.getFolderId(targetEmail, 'Complaints');
    if (!complaintsFolderId) throw new Error("Complaints folder not found");

    const complaints = [
        {
            subject: "Baggage Damage - Flight 6E-101",
            body: `
            Dear Support,
            My bag was damaged on flight 6E-101 from DEL to BLR.
            The handle is broken and there is a tear in the side.
            PNR: AB12CD
            Please advise on the compensation process.
            `
        },
        {
            subject: "Refund Request: Cancelled Flight 6E-202",
            body: `
            Hi,
            My flight 6E-202 from CCU to MAA was cancelled yesterday.
            I haven't received my refund yet. 
            PNR: EF34GH
            Can you please check the status?
            `
        }
    ];

    for (const c of complaints) {
        console.log(`Injecting complaint: ${c.subject}`);
        await outlook.createMessageInFolder(targetEmail, complaintsFolderId, c.subject, c.body);
    }

    console.log("All test complaints injected successfully!");
}

injectTestComplaints().catch(console.error);
