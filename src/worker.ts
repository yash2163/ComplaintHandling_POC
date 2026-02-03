import { OutlookService } from './services/outlook';
import { AgentService } from './services/agent';
import prisma from './services/db';
import { ComplaintStatus, AuthorType, MessageType } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const POLL_INTERVAL_MS = 60000; // 60s

async function runWorker() {
    console.log('Worker started...');
    const outlook = new OutlookService();
    const agent = new AgentService();

    // Ensure Auth
    await outlook.authenticate();

    while (true) {
        try {
            console.log('Polling cycle start...');
            await pollCycle(outlook, agent);
        } catch (error) {
            console.error('Error in poll cycle:', error);
        }

        // Wait
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
}

async function pollCycle(outlook: OutlookService, agent: AgentService) {
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL;
    if (!targetEmail) return;

    // 1. INGESTION
    const messages = await outlook.getRecentEmails(targetEmail, 10);

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

            console.log(`New Email found: ${msg.subject}`);

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
                                from: msg.from?.emailAddress?.address || 'unknown',
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
    // Find NEW complaints that DO NOT have a GRID message yet (Double idempotency check)
    const newComplaints = await prisma.complaint.findMany({
        where: {
            status: ComplaintStatus.NEW,
            conversation: {
                none: { messageType: MessageType.GRID }
            }
        },
        include: { conversation: true } // Need body from conversation
    });

    for (const complaint of newComplaints) {
        console.log(`Processing Agent 1 for ${complaint.id}...`);

        // Find the CX Email content
        const emailMsg = complaint.conversation.find(c => c.messageType === MessageType.EMAIL);
        if (!emailMsg) continue;

        const emailContent = emailMsg.content as any; // Cast from Json

        // Extract
        const extraction = await agent.extractInvestigationGrid({
            body: emailContent.body,
            subject: complaint.subject,
            receivedAt: new Date(emailContent.receivedAt)
        } as any); // Adapt to domain type if needed

        // Update DB
        const gridContent = { gridFields: extraction.grid, confidence: extraction.confidence } as any;
        await prisma.$transaction([
            prisma.conversationMessage.create({
                data: {
                    complaintId: complaint.id,
                    authorType: AuthorType.AGENT,
                    messageType: MessageType.GRID,
                    content: gridContent
                }
            }),
            prisma.complaint.update({
                where: { id: complaint.id },
                data: {
                    status: ComplaintStatus.WAITING_OPS,
                    originStation: extraction.grid.origin_station // Agent must extract this now
                }
            })
        ]);

        console.log(`Agent 1 completed for ${complaint.id}. Station: ${extraction.grid.origin_station}`);

        // --- DRAFT CREATION FOR BASE OPS ---
        try {
            // Use TARGET_MAILBOX_EMAIL since that's the inbox we're managing
            // In production, this would be BASE_OPS_EMAIL
            const draftTargetEmail = process.env.TARGET_MAILBOX_EMAIL!;

            // 1. Generate HTML Table from Grid
            const gridRows = Object.entries(extraction.grid).map(([key, value]) => `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold; text-transform: capitalize;">${key.replace(/_/g, ' ')}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${value || '-'}</td>
                </tr>
            `).join('');

            const htmlBody = `
                <h3>Flight Complaint Investigation Request</h3>
                <p><strong>Complaint ID:</strong> ${complaint.id}</p>
                <p><strong>Status:</strong> WAITING_OPS</p>
                
                <h4>Extracted Details</h4>
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

            // 2. Create Draft
            await outlook.createDraft(
                draftTargetEmail,
                `[Action Required] Investigation for Flight ${extraction.grid.flight_number || 'Unknown'} - ${complaint.subject}`,
                htmlBody
            );
            console.log(`Draft created for Base Ops (${draftTargetEmail})`);

        } catch (draftError) {
            console.error('Failed to create validation draft for Base Ops:', draftError);
            // Continue -> Do not fail the whole cycle just because draft failed, DB is already updated.
        }

    }
}

runWorker();
