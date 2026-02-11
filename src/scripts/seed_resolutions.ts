import prisma from '../services/db';
import { OutlookService } from '../services/outlook';
import { ComplaintStatus, AuthorType, MessageType } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

async function seedResolutions() {
    console.log('Starting Resolution seeding...');

    // 1. Create a Seed Complaint that is WAITING_OPS
    // We need a complaint ID to put in the subject line: [Case: UUID]

    // Check if we already have a seed complaint to reuse, or create new
    const pnr = 'RESO99';
    let complaint = await prisma.complaint.findFirst({
        where: { pnr: pnr }
    });

    if (complaint) {
        console.log(`Found existing complaint ${complaint.id} for PNR ${pnr}. Resetting status.`);
        await prisma.complaint.update({
            where: { id: complaint.id },
            data: {
                status: ComplaintStatus.WAITING_OPS,
                resolutionStatus: 'PENDING',
                resolutionSummary: null,
                agentReasoning: null
            }
        });
    } else {
        console.log(`Creating new complaint for PNR ${pnr}...`);
        complaint = await prisma.complaint.create({
            data: {
                originalEmailId: `seed-resolution-${Date.now()}`,
                subject: "Damaged Luggage Claim - Urgent",
                status: ComplaintStatus.WAITING_OPS,
                pnr: pnr,
                customerName: "Alice Validation",
                flightNumber: "6E-999",
                seatNumber: "1A",
                source: "BOM",
                destination: "DEL",
                complaintDetail: "Passenger claims checked-in bag handle is broken.",
                conversation: {
                    create: {
                        authorType: AuthorType.CX,
                        messageType: MessageType.EMAIL,
                        content: {
                            body: "My bag handle is completely broken! I need compensation.",
                            from: "alice@example.com",
                            receivedAt: new Date()
                        }
                    }
                }
            }
        });
    }

    console.log(`Target Complaint ID: ${complaint.id}`);

    // 2. Inject Email into Resolutions Folder
    const outlook = new OutlookService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL;
    if (!targetEmail) throw new Error("TARGET_MAILBOX_EMAIL not set");

    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');
    if (!resolutionsFolderId) throw new Error("Resolutions folder not found");

    console.log(`Injecting Resolution Email into folder ${resolutionsFolderId}...`);

    const resolutionSubject = `[Case: ${complaint.id}] Re: Investigation for 6E-999 - Damaged Luggage`;
    const resolutionBody = `
    Hi Team,

    We have inspected the baggage for passenger Alice Validation (PNR: RESO99).
    Confirmed that the handle was damaged during transit. 
    However, the bag was already tagged as 'Fragile - Limited Release', so liability is limited.
    We can offer a voucher of 500 INR as a goodwill gesture.
    
    Regards,
    Station Manager, DEL
    `;

    await outlook.createMessageInFolder(targetEmail, resolutionsFolderId, resolutionSubject, resolutionBody);

    console.log('Resolution email injected successfully.');
    console.log('---------------------------------------------------');
    console.log('Now ensure your worker is running: npm run start:worker');
    console.log('It should pick this up and resolve the case.');
}

seedResolutions().catch(console.error).finally(() => prisma.$disconnect());
