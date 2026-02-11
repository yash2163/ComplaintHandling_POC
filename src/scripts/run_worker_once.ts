/**
 * This script runs the worker logic ONCE and then exits.
 * Used for controlled testing without infinite polling.
 */

import { OutlookService } from '../services/outlook';
import { AgentService } from '../services/agent';
import prisma from '../services/db';
import { ComplaintStatus, AuthorType, MessageType, ResolutionStatus } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function runWorkerOnce() {
    console.log('Worker started...');
    const outlook = new OutlookService();
    const agent = new AgentService();

    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL;
    if (!targetEmail) {
        console.error('TARGET_MAILBOX_EMAIL not set');
        return;
    }

    const complaintsFolderId = await outlook.getFolderId(targetEmail, 'Complaints');
    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');

    if (!complaintsFolderId || !resolutionsFolderId) {
        console.error('CRITICAL: "Complaints" or "Resolutions" folder not found.');
        return;
    }

    console.log(`Monitoring Folders: Complaints (${complaintsFolderId}), Resolutions (${resolutionsFolderId})`);
    console.log('Polling cycle start...');
    await processComplaints(outlook, agent, targetEmail, complaintsFolderId);
    await processResolutions(outlook, agent, targetEmail, resolutionsFolderId);
    console.log('Worker cycle complete. Exiting.');
}

async function processComplaints(outlook: OutlookService, agent: AgentService, targetEmail: string, folderId: string) {
    const messages = await outlook.getEmailsFromFolder(targetEmail, folderId, 10);

    for (const msg of messages) {
        const existing = await prisma.complaint.findUnique({
            where: { originalEmailId: msg.id }
        });

        if (!existing) {
            const isComplaint = await agent.isAirlineComplaint(msg.subject || '', msg.bodyPreview || '');
            if (!isComplaint) {
                console.log(`Skipped non-complaint email: ${msg.subject}`);
                continue;
            }

            console.log(`New Email found in Complaints: ${msg.subject}`);
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
                                body: msg.bodyPreview || '',
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

    // Agent 1 Processing
    const newComplaints = await prisma.complaint.findMany({
        where: {
            status: ComplaintStatus.NEW
        },
        include: { conversation: true }
    });

    for (const complaint of newComplaints) {
        // Skip if already has a grid
        if (complaint.investigationGrid) continue;

        console.log(`Processing Agent 1 for ${complaint.id}...`);
        const emailMsg = complaint.conversation.find((c: any) => c.messageType === MessageType.EMAIL);
        if (!emailMsg) continue;

        const emailContent = emailMsg.content as any;
        const customerEmail = emailContent.from || 'unknown';

        const extraction = await agent.extractInvestigationGrid({
            body: emailContent.body,
            subject: complaint.subject,
            receivedAt: new Date(emailContent.receivedAt)
        } as any);

        const extractedPnr = extraction.grid.pnr;
        let passengerDetails = null;

        if (extractedPnr) {
            passengerDetails = await prisma.passenger.findUnique({
                where: { pnr: extractedPnr }
            });
        }

        if (passengerDetails) {
            console.log(`PNR Found: ${extractedPnr}. Populating details for ${passengerDetails.customerName}`);

            const completeGrid = {
                pnr: extractedPnr || null,
                customer_name: passengerDetails.customerName,
                flight_number: passengerDetails.flightNumber,
                seat_number: passengerDetails.seatNumber,
                source: passengerDetails.source,
                destination: passengerDetails.destination,
                complaint: extraction.grid.complaint || null,
                issue_type: extraction.grid.issue_type || null,
                weather_condition: extraction.grid.weather_condition || null,
                date: extraction.grid.date || null,
                action_taken: null,
                outcome: null,
                agent_summary: null,
                confidence_score: null,
                agent_reasoning: null
            };

            await prisma.complaint.update({
                where: { id: complaint.id },
                data: {
                    status: ComplaintStatus.WAITING_OPS,
                    investigationGrid: completeGrid as any
                }
            });

            await prisma.conversationMessage.create({
                data: {
                    complaintId: complaint.id,
                    authorType: AuthorType.AGENT,
                    messageType: MessageType.GRID,
                    content: { grid: completeGrid, agentType: 'AGENT_1', confidence: extraction.confidence }
                }
            });

            try {
                const draftTargetEmail = process.env.TARGET_MAILBOX_EMAIL!;
                const gridText = agent.formatGridAsStructuredText(completeGrid);

                const htmlBody = `
                    <h3>✈️ Action Required: Flight Complaint Investigation</h3>
                    <p><strong>Complaint ID:</strong> ${complaint.id}</p>
                    
                    <h4>Original Complaint</h4>
                    <p style="background-color: #f9f9f9; padding: 10px; border-left: 4px solid #0052cc;">${completeGrid.complaint}</p>

                    <hr style="border: 1px dashed #ccc; margin: 20px 0;">
                    
                    <h3 style="color: #d9534f;">📋 Investigation Grid</h3>
                    <pre style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace; white-space: pre-wrap;">${gridText}</pre>
                    
                    <hr style="border: 1px dashed #ccc; margin: 20px 0;">
                    
                    <h3 style="color: #d9534f;">👇 ACTION REQUIRED 👇</h3>
                    <p><strong>Please update the grid above by adding:</strong></p>
                    <ul>
                        <li><strong>Action Taken:</strong> What action did the crew take?</li>
                        <li><strong>Outcome:</strong> What was the final result/compensation?</li>
                    </ul>
                    <p>Reply to this email with the <strong>complete updated grid</strong>.</p>
                `;

                await outlook.createDraft(
                    draftTargetEmail,
                    `[ACTION REQUIRED] Investigation Request: ${complaint.subject} - PNR: ${extractedPnr} [Case: ${complaint.id}]`,
                    htmlBody
                );
                console.log(`Base Ops draft created for ${complaint.id}`);
            } catch (draftError) {
                console.error('Failed to create Base Ops draft:', draftError);
            }

        } else {
            console.log(`PNR ${extractedPnr || 'MISSING'} not found. Marking as MISSING_INFO.`);

            const incompleteGrid = {
                pnr: extractedPnr,
                customer_name: null,
                flight_number: null,
                seat_number: null,
                source: null,
                destination: null,
                complaint: extraction.grid.complaint,
                issue_type: extraction.grid.issue_type,
                weather_condition: extraction.grid.weather_condition,
                date: extraction.grid.date,
                action_taken: null,
                outcome: null,
                agent_summary: null,
                confidence_score: null,
                agent_reasoning: null
            };

            await prisma.complaint.update({
                where: { id: complaint.id },
                data: {
                    status: ComplaintStatus.MISSING_INFO,
                    investigationGrid: incompleteGrid as any
                }
            });

            try {
                const draftTargetEmail = process.env.TARGET_MAILBOX_EMAIL!;
                const customerDraftBody = `
                    <p>Dear Customer,</p>
                    <p>Thank you for reaching out to Indigo. We have received your complaint: <i>"${extraction.grid.complaint || complaint.subject}"</i>.</p>
                    <p>However, we were unable to locate your flight details with the PNR provided: <b>${extractedPnr || 'None'}</b>.</p>
                    <p>To assist you further, please provide the correct 6-character PNR number.</p>
                    <p>Regards,<br/>Indigo Customer Experience Team</p>
                    <br/><hr/>
                    <p><small>Reference ID: ${complaint.id}</small></p>
                `;

                await outlook.createDraft(
                    draftTargetEmail,
                    `Action Required: Missing Flight Details for Case ${complaint.id}`,
                    customerDraftBody,
                    customerEmail
                );
                console.log(`Draft created for CUSTOMER (${customerEmail}) requesting PNR.`);
            } catch (draftError) {
                console.error('Failed to create customer PNR request draft:', draftError);
            }
        }
    }
}

async function processResolutions(outlook: OutlookService, agent: AgentService, targetEmail: string, folderId: string) {
    const messages = await outlook.getEmailsFromFolder(targetEmail, folderId, 10);

    for (const msg of messages) {
        const caseIdMatch = msg.subject?.match(/\[Case:\s*([a-f0-9\-]+)\]/i);
        if (!caseIdMatch) {
            console.log(`Skipping resolution email without Case ID: ${msg.subject}`);
            continue;
        }

        const complaintId = caseIdMatch[1];
        const complaint = await prisma.complaint.findUnique({
            where: { id: complaintId },
            include: { conversation: true }
        });

        if (!complaint) {
            console.log(`Complaint not found for ID: ${complaintId}`);
            continue;
        }

        if (complaint.resolutionStatus !== 'PENDING') {
            console.log(`Complaint ${complaintId} already processed. Skipping.`);
            continue;
        }

        console.log(`Processing Resolution for Case ${complaintId}...`);

        const emailBody = (msg.body as any)?.content || msg.bodyPreview || '';
        const parsedGrid = agent.parseGridFromEmail(emailBody);

        if (!parsedGrid || !parsedGrid.action_taken || !parsedGrid.outcome) {
            console.warn(`Failed to parse grid or missing action_taken/outcome for ${complaintId}`);
            continue;
        }

        const currentGrid = complaint.investigationGrid as any;
        const updatedGrid = {
            ...currentGrid,
            action_taken: parsedGrid.action_taken,
            outcome: parsedGrid.outcome
        };

        const originalMsg = complaint.conversation.find(c => c.messageType === MessageType.EMAIL);
        const originalBody = (originalMsg?.content as any)?.body || '';

        const enhancement = await agent.enhanceGridWithResolution(
            updatedGrid,
            { subject: complaint.subject, body: originalBody }
        );

        const finalGrid = enhancement.enhanced_grid;
        const newStatus = enhancement.status === 'RESOLVED' ? ResolutionStatus.RESOLVED : ResolutionStatus.FLAGGED;
        const mainStatus = newStatus === ResolutionStatus.RESOLVED ? ComplaintStatus.RESOLVED : ComplaintStatus.WAITING_OPS;

        let scoreColor = 'RED';
        if ((finalGrid as any).confidence_score && (finalGrid as any).confidence_score >= 80) scoreColor = 'GREEN';
        else if ((finalGrid as any).confidence_score && (finalGrid as any).confidence_score >= 60) scoreColor = 'YELLOW';

        console.log(`Agent 2 Evaluation: ${enhancement.status} (Confidence: ${(finalGrid as any).confidence_score}) - ${scoreColor}`);

        await prisma.complaint.update({
            where: { id: complaintId },
            data: {
                investigationGrid: finalGrid as any,
                resolutionStatus: newStatus,
                crReviewStatus: 'PENDING',
                status: mainStatus
            }
        });

        await prisma.conversationMessage.create({
            data: {
                complaintId,
                authorType: AuthorType.BASE_OPS,
                messageType: MessageType.EMAIL,
                content: {
                    body: emailBody,
                    subject: msg.subject,
                    receivedAt: msg.receivedDateTime
                }
            }
        });

        if (enhancement.draft_response) {
            const draftTargetEmail = process.env.TARGET_MAILBOX_EMAIL!;
            const finalGridText = agent.formatGridAsStructuredText(finalGrid as any);

            const htmlBody = `
                <p>Dear Customer,</p>
                <p>We have completed the investigation regarding your complaint: <strong>${complaint.subject}</strong>.</p>
                
                <hr style="border: 1px dashed #ccc; margin: 20px 0;">
                
                <h3>📋 Resolution Grid</h3>
                <pre style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; font-family: monospace; white-space: pre-wrap;">${finalGridText}</pre>
                
                <hr style="border: 1px dashed #ccc; margin: 20px 0;">

                <p>${enhancement.draft_response}</p>

                <p>Sincerely,<br/>
                <strong>Indigo Customer Relations</strong><br/>
                <span style="font-size: 10px; color: #888;">Ref: ${complaint.id} | Score: ${(finalGrid as any).confidence_score || 0}%</span></p>
            `;

            await outlook.createDraft(
                draftTargetEmail,
                `[RESPONSE] Resolution for your complaint - ${complaint.subject} (PNR: ${(finalGrid as any).pnr || 'N/A'})`,
                htmlBody
            );
            console.log(`Draft response created for CX (Score: ${(finalGrid as any).confidence_score} - ${scoreColor}).`);
        }
    }
}

runWorkerOnce().then(() => process.exit(0));
