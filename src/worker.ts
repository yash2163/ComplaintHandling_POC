import { OutlookService } from './services/outlook';
import { AgentService } from './services/agent';
import prisma from './services/db';
import { ComplaintStatus, AuthorType, MessageType, ResolutionStatus } from '@prisma/client';
import dotenv from 'dotenv';
import { Agent } from 'http';

dotenv.config();

const POLL_INTERVAL_MS = 60000; // 60s

async function runWorker() {
    console.log('Worker started...');
    const outlook = new OutlookService();
    const agent = new AgentService();

    // Ensure Auth
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL;
    if (!targetEmail) {
        console.error('TARGET_MAILBOX_EMAIL not set');
        return;
    }

    // Get Folder IDs
    const complaintsFolderId = await outlook.getFolderId(targetEmail, 'Complaints');
    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');

    if (!complaintsFolderId || !resolutionsFolderId) {
        console.error('CRITICAL: "Complaints" or "Resolutions" folder not found in Outlook.');
        console.error('Please create these folders manually.');
        return;
    }

    console.log(`Monitoring Folders: Complaints (${complaintsFolderId}), Resolutions (${resolutionsFolderId})`);

    while (true) {
        try {
            console.log('Polling cycle start...');
            await processComplaints(outlook, agent, targetEmail, complaintsFolderId);
            await processResolutions(outlook, agent, targetEmail, resolutionsFolderId);
        } catch (error) {
            console.error('Error in poll cycle:', error);
        }

        // Wait
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
}

async function processComplaints(outlook: OutlookService, agent: AgentService, targetEmail: string, folderId: string) {
    // 1. INGESTION from "Complaints" Folder
    const messages = await outlook.getEmailsFromFolder(targetEmail, folderId, 10);

    for (const msg of messages) {
        // Idempotency: Check if complaint exists by originalEmailId
        const existing = await prisma.complaint.findUnique({
            where: { originalEmailId: msg.id }
        });

        if (!existing) {
            // 1.1 CLASSIFICATION
            const isComplaint = await agent.isAirlineComplaint(msg.subject || '', msg.bodyPreview || '');

            if (!isComplaint) {
                console.log(`Skipped non-complaint email: ${msg.subject}`);
                continue;
            }

            console.log(`New Email found in Complaints: ${msg.subject}`);

            // Create Complaint
            const complaint = await prisma.complaint.create({
                data: {
                    originalEmailId: msg.id,
                    subject: msg.subject || '(No Subject)',
                    status: ComplaintStatus.NEW,
                    conversation: {
                        create: {
                            authorType: AuthorType.CX,
                            messageType: MessageType.EMAIL,
                            content: {
                                body: msg.bodyPreview || '', // In real app, fetch full body
                                from: msg.from?.emailAddress?.address || 'unknown', // Accessing from safely
                                receivedAt: msg.receivedDateTime
                            }
                        }
                    }
                }
            });
            console.log(`Created Complaint ${complaint.id}`);
        }
    }

    // 2. AGENT 1 (Extraction)
    // Find NEW complaints that DO NOT have a GRID message yet
    const newComplaints = await prisma.complaint.findMany({
        where: {
            status: ComplaintStatus.NEW,
            conversation: {
                none: { messageType: MessageType.GRID }
            }
        },
        include: { conversation: true }
    });

    for (const complaint of newComplaints) {
        console.log(`Processing Agent 1 for ${complaint.id}...`);

        const emailMsg = complaint.conversation.find(c => c.messageType === MessageType.EMAIL);
        if (!emailMsg) continue;

        const emailContent = emailMsg.content as any;
        const customerEmail = emailContent.from || 'unknown';

        // 1. EXTRACT PNR and Complaint Detail
        const extraction = await agent.extractInvestigationGrid({
            body: emailContent.body,
            subject: complaint.subject,
            receivedAt: new Date(emailContent.receivedAt)
        } as any);

        const extractedPnr = extraction.grid.pnr;
        let passengerDetails = null;

        // 2. TOOL CALL (Database Lookup)
        if (extractedPnr) {
            passengerDetails = await prisma.passenger.findUnique({
                where: { pnr: extractedPnr }
            });
        }

        if (passengerDetails) {
            console.log(`PNR Found: ${extractedPnr}. Populating details for ${passengerDetails.customerName}`);

            // Found: Update Grid and Complaint
            const gridFields = {
                ...extraction.grid,
                customer_name: passengerDetails.customerName,
                flight_number: passengerDetails.flightNumber,
                seat_number: passengerDetails.seatNumber,
                source: passengerDetails.source,
                destination: passengerDetails.destination
            };

            await prisma.$transaction([
                prisma.conversationMessage.create({
                    data: {
                        complaintId: complaint.id,
                        authorType: AuthorType.AGENT,
                        messageType: MessageType.GRID,
                        content: { gridFields, confidence: extraction.confidence }
                    }
                }),
                prisma.complaint.update({
                    where: { id: complaint.id },
                    data: {
                        status: ComplaintStatus.WAITING_OPS,
                        originStation: passengerDetails.source, // Assuming source is the origin
                        pnr: extractedPnr,
                        customerName: passengerDetails.customerName,
                        flightNumber: passengerDetails.flightNumber,
                        seatNumber: passengerDetails.seatNumber,
                        source: passengerDetails.source,
                        destination: passengerDetails.destination,
                        complaintDetail: extraction.grid.complaint
                    }
                })
            ]);

            // Create Draft for Base Ops
            try {
                const draftTargetEmail = process.env.TARGET_MAILBOX_EMAIL!;
                const gridRows = Object.entries(gridFields).map(([key, value]) => `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold; text-transform: capitalize;">${key.replace(/_/g, ' ')}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${value || '-'}</td>
                    </tr>
                `).join('');

                const htmlBody = `
                    <h3>Flight Complaint Investigation Request</h3>
                    <p><strong>Complaint ID:</strong> ${complaint.id}</p>
                    <p><strong>Status:</strong> WAITING_OPS</p>
                    
                    <h4>Extracted & Database Details</h4>
                    <table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 14px; margin-bottom: 20px;">
                        <tbody>
                            ${gridRows}
                        </tbody>
                    </table>
                    <hr style="border: 0; border-top: 1px solid #ccc; margin: 20px 0;" />
                    <h4>Original Customer Email</h4>
                    <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; font-family: monospace; white-space: pre-wrap;">
                        ${emailContent.body}
                    </div>
                `;

                await outlook.createDraft(
                    draftTargetEmail,
                    `[Case: ${complaint.id}] Investigation for ${passengerDetails.flightNumber} - ${complaint.subject}`,
                    htmlBody
                );
            } catch (draftError) {
                console.error('Failed to create Base Ops draft:', draftError);
            }

        } else {
            // Missing or Not Found: Highlight in Dashboard and Draft to Customer
            console.log(`PNR ${extractedPnr || 'MISSING'} not found. Marking as MISSING_INFO.`);

            await prisma.complaint.update({
                where: { id: complaint.id },
                data: {
                    status: ComplaintStatus.MISSING_INFO,
                    pnr: extractedPnr, // Store whatever was extracted (even if null)
                    complaintDetail: extraction.grid.complaint
                }
            });

            // Create Draft for CUSTOMER
            try {
                const draftTargetEmail = process.env.TARGET_MAILBOX_EMAIL!; // Draft in our box, but To: customer
                const customerDraftBody = `
                    <p>Dear Customer,</p>
                    <p>Thank you for reaching out to Indigo. We have received your complaint: <i>"${extraction.grid.complaint || complaint.subject}"</i>.</p>
                    <p>However, we were unable to locate your flight details with the PNR provided: <b>${extractedPnr || 'None'}</b>.</p>
                    <p>To assist you further, please provide the correct 6-character PNR number. You can reply to this email or send us the details at your earliest convenience.</p>
                    <p>Regards,<br/>Indigo Customer Experience Team</p>
                    <br/><hr/>
                    <p><small>Reference ID: ${complaint.id}</small></p>
                `;

                // Re-using createDraft but we should ideally target the customer email in 'toRecipients'
                // The current outlook.ts implementation sends to targetEmail. 
                // I'll update outlook.createDraft to accept a recipient if I can, or just use the current one for POC.
                // Wait, if I want it in Drafts folder, I often create it with the recipient already set.

                await outlook.createDraft(
                    draftTargetEmail, // Mailbox to create draft in
                    `Action Required: Missing Flight Details for Case ${complaint.id}`,
                    customerDraftBody,
                    customerEmail // Real recipient
                );
                console.log(`Draft created for CUSTOMER (${customerEmail}) requesting PNR.`);
            } catch (draftError) {
                console.error('Failed to create customer PNR request draft:', draftError);
            }
        }
    }
}

async function processResolutions(outlook: OutlookService, agent: AgentService, targetEmail: string, folderId: string) {
    // Fetch from Resolutions folder
    const messages = await outlook.getEmailsFromFolder(targetEmail, folderId, 10);

    for (const msg of messages) {
        // Regex to extract Case ID: [Case: UUID]
        const caseIdMatch = msg.subject?.match(/\[Case:\s*([a-f0-9\-]+)\]/i);
        if (!caseIdMatch) {
            console.log(`Skipping resolution check for email without Case ID: ${msg.subject}`);
            continue;
        }

        const complaintId = caseIdMatch[1];

        // Find Complaint
        const complaint = await prisma.complaint.findUnique({
            where: { id: complaintId },
            include: { conversation: true }
        });

        if (!complaint) {
            console.log(`Complaint not found for ID: ${complaintId}`);
            continue;
        }

        // Check if already processed (Idempotency)
        // We check if we already have a FINAL message or if resolutionStatus is not PENDING?
        // Actually, user might send multiple emails. Let's process if resolutionStatus is PENDING or FLAGGED?
        // Or better, check if THIS specific email has been processed? 
        // We don't store resolution email IDs in DB currently. 
        // Simplification: Check if resolutionStatus is 'PENDING'.
        if (complaint.resolutionStatus === 'RESOLVED') {
            // Already resolved, skip
            // console.log(`Complaint ${complaintId} already resolved. Skipping.`);
            // continue;
            // Wait, what if this is a NEW resolution?
        }

        // Check if we have already processed this exact resolution email?
        // We can add a "processedResolutions" table or just check if the last updated time was recent.
        // For POC, let's assume we process if status is PENDING or FLAGGED.
        // But we need to avoid reprocessing the SAME email in every loop.
        // How? We don't mark the email as read in Outlook.
        // We could store the "latestResolutionEmailId" on the Complaint model?
        // Or we can just check if the resolutionSummary is already set and same?
        // Let's perform the check: If resolutionStatus is PENDING, we go.

        if (complaint.resolutionStatus !== 'PENDING') {
            // For now, only process if PENDING to avoid loops.
            // Ideally we should process FLAGGED too if new email comes, but simplicity first.
            continue;
        }

        console.log(`Processing Resolution for Case ${complaintId}...`);

        // Get Original Complaint Body
        const originalMsg = complaint.conversation.find(c => c.messageType === MessageType.EMAIL);
        const originalBody = (originalMsg?.content as any)?.body || '';
        const crewBody = msg.bodyPreview || msg.body?.content || '';

        // Run Agent 2
        const evaluation = await agent.evaluateResolution(
            { subject: complaint.subject, body: originalBody },
            { subject: msg.subject, body: crewBody }
        );

        console.log(`Agent 2 Evaluation: ${evaluation.status}`);

        // Update DB
        const newStatus = evaluation.status === 'RESOLVED' ? ResolutionStatus.RESOLVED : ResolutionStatus.FLAGGED;
        const mainStatus = newStatus === ResolutionStatus.RESOLVED ? ComplaintStatus.RESOLVED : ComplaintStatus.WAITING_OPS; // Or stay WAITING_OPS if flagged

        await prisma.complaint.update({
            where: { id: complaintId },
            data: {
                resolutionStatus: newStatus,
                agentReasoning: evaluation.reasoning,
                resolutionSummary: evaluation.summary,
                status: mainStatus
                // We should also probably add the resolution email to conversation history?
            }
        });

        // Add to Conversation History
        /*
        await prisma.conversationMessage.create({
            data: {
                complaintId,
                authorType: AuthorType.BASE_OPS, // Crew/Ops
                messageType: MessageType.EMAIL,  // It's an email response
                content: { body: crewBody, subject: msg.subject }
            }
        });
        */

        // Create Draft Response to CX (if resolved or flagged? User said agent generates draft to CX explaining)
        if (evaluation.draft_response) {
            // Find customer email
            const customerEmail = (originalMsg?.content as any)?.from || '';
            const draftTargetEmail = process.env.TARGET_MAILBOX_EMAIL!; // We draft in OUR box

            await outlook.createDraft(
                draftTargetEmail,
                `RE: ${complaint.subject} [Ref: ${complaintId}]`,
                evaluation.draft_response
            );
            console.log(`Draft response created for CX.`);
        }
    }
}

runWorker();
