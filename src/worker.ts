import { OutlookService } from './services/outlook';
import { AgentService, CompleteInvestigationGrid } from './services/agent';
import { WeatherService } from './services/weather';
import prisma from './services/db';
import { ComplaintStatus, AuthorType, MessageType, ResolutionStatus } from '@prisma/client';
import dotenv from 'dotenv';

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
                                body: msg.body?.content || msg.bodyPreview || '',
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
    // Find NEW complaints that have NO investigationGrid yet
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

            // 3. WEATHER CHECK (New Feature)
            let weatherData = null;
            let weatherInfo = '-';
            try {
                // Use passenger flight date if available (primary source of truth), 
                // otherwise fallback to grid date or today
                const flightDate = passengerDetails.flightDate
                    ? new Date(passengerDetails.flightDate)
                    : (extraction.grid.date ? new Date(extraction.grid.date) : new Date());

                const weatherService = new WeatherService();
                weatherData = await weatherService.getWeatherForFlight(
                    passengerDetails.flightNumber,
                    flightDate,
                    passengerDetails.source
                );

                if (weatherData) {
                    console.log(`Weather Data Found: ${weatherData.weather} (Vis: ${weatherData.visibility})`);
                    weatherInfo = `${weatherData.weather || ''} ${weatherData.visibility ? `(Vis: ${weatherData.visibility})` : ''}`.trim();
                }
            } catch (wErr) {
                console.error('Weather check failed:', wErr);
            }

            // 4. AUTO-RESOLVE CHECK (AI)
            let autoResolve = { shouldResolve: false, reason: '', draft: '' };
            if (weatherData && (extraction.grid.issue_type === 'Delay' || extraction.grid.issue_type === 'Turbulence')) {
                console.log('Checking for Auto-Resolution...');
                autoResolve = await agent.shouldAutoResolve(
                    {
                        subject: complaint.subject,
                        body: emailContent.body,
                        issue_type: extraction.grid.issue_type
                    },
                    weatherData
                );
                console.log(`Auto-Resolve Decision: ${autoResolve.shouldResolve} (${autoResolve.reason})`);
            }

            // Create complete grid
            const completeGrid: CompleteInvestigationGrid = {
                pnr: extractedPnr || null,
                customer_name: passengerDetails.customerName,
                flight_number: passengerDetails.flightNumber,
                seat_number: passengerDetails.seatNumber,
                source: passengerDetails.source,
                destination: passengerDetails.destination,
                complaint: extraction.grid.complaint || null,
                issue_type: extraction.grid.issue_type || null,
                weather_condition: weatherInfo !== '-' ? weatherInfo : (extraction.grid.weather_condition || '-'),
                date: extraction.grid.date || null,
                // If auto-resolved, fill resolution fields immediately
                action_taken: autoResolve.shouldResolve ? `Auto-Resolved: Weather Condition Verified (${weatherInfo})` : null,
                outcome: autoResolve.shouldResolve ? `Customer notified of Force Majeure. ${autoResolve.reason}` : null,
                agent_summary: autoResolve.shouldResolve ? `AI Agent verified adverse weather (${weatherInfo}) as the sole cause of delay.` : null,
                confidence_score: autoResolve.shouldResolve ? 100 : null,
                agent_reasoning: autoResolve.shouldResolve ? autoResolve.reason : null
            };

            // Save grid to DB
            // If Auto-Resolved, mark as RESOLVED immediately
            // Else, mark as WAITING_OPS
            const finalStatus = autoResolve.shouldResolve ? ComplaintStatus.RESOLVED : ComplaintStatus.WAITING_OPS;
            const resolutionStatus = autoResolve.shouldResolve ? ResolutionStatus.RESOLVED : ResolutionStatus.PENDING;

            await prisma.complaint.update({
                where: { id: complaint.id },
                data: {
                    status: finalStatus,
                    resolutionStatus: resolutionStatus,
                    investigationGrid: completeGrid as any
                }
            });

            // Create GRID message in conversation
            await prisma.conversationMessage.create({
                data: {
                    complaintId: complaint.id,
                    authorType: AuthorType.AGENT,
                    messageType: MessageType.GRID,
                    content: { grid: completeGrid, agentType: 'AGENT_1', confidence: extraction.confidence } as any
                }
            });

            if (autoResolve.shouldResolve) {
                // SKIP Base Ops. Send final email to CX (Draft) directly.
                try {
                    const draftTargetEmail = process.env.TARGET_MAILBOX_EMAIL!;
                    const finalGridHtml = agent.formatGridAsHtmlTable(completeGrid);

                    const htmlBody = `
                        <p>Dear Customer,</p>
                        <p>We have completed the investigation regarding your complaint: <strong>${complaint.subject}</strong>.</p>
                        
                        <hr style="border: 1px dashed #ccc; margin: 20px 0;">
                        ${finalGridHtml}
                        <hr style="border: 1px dashed #ccc; margin: 20px 0;">

                        <p>${autoResolve.draft}</p>

                        <p>Sincerely,<br/>
                        <strong>Indigo Customer Relations</strong><br/>
                        <span style="font-size: 10px; color: #888;">Ref: ${complaint.id} | Auto-Resolved</span></p>
                    `;

                    await outlook.createDraft(
                        draftTargetEmail,
                        `[RESPONSE] Resolution for your complaint - ${complaint.subject} (PNR: ${extractedPnr})`,
                        htmlBody
                    );
                    console.log(`Auto-Resolution: Draft response created for CX.`);
                } catch (draftError) {
                    console.error('Failed to create Auto-Resolve draft:', draftError);
                }

            } else {
                // STANDARD FLOW: Create Draft for Base Ops
                try {
                    const draftTargetEmail = process.env.TARGET_MAILBOX_EMAIL!;
                    const gridHtml = agent.formatGridAsHtmlTable(completeGrid);

                    const htmlBody = `
                        <h3>✈️ Action Required: Flight Complaint Investigation</h3>
                        <p><strong>Complaint ID:</strong> ${complaint.id}</p>
                        <p><strong>Status:</strong> WAITING_OPS</p>
                        
                        <h4>Original Complaint</h4>
                        <p style="background-color: #f9f9f9; padding: 10px; border-left: 4px solid #0052cc;">${completeGrid.complaint}</p>

                        <hr style="border: 1px dashed #ccc; margin: 20px 0;">
                        
                        ${gridHtml}
                        
                        <hr style="border: 1px dashed #ccc; margin: 20px 0;">
                        
                        <h3 style="color: #d9534f;">👇 ACTION REQUIRED 👇</h3>
                        <p><strong>Please fill in the RESOLUTION section of the grid table above:</strong></p>
                        <ul>
                            <li><strong>Action Taken:</strong> What action did the crew take?</li>
                            <li><strong>Outcome:</strong> What was the final result/compensation?</li>
                        </ul>
                        <p><strong>Reply to this email</strong> with the updated grid. The hidden text version will be parsed automatically.</p>
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
            }

        } else {
            // Missing or Not Found: Mark as MISSING_INFO
            console.log(`PNR ${extractedPnr || 'MISSING'} not found. Marking as MISSING_INFO.`);

            const incompleteGrid: CompleteInvestigationGrid = {
                pnr: extractedPnr || null,
                customer_name: null,
                flight_number: null,
                seat_number: null,
                source: null,
                destination: null,
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
                    status: ComplaintStatus.MISSING_INFO,
                    investigationGrid: incompleteGrid as any
                }
            });

            // Create Draft for CUSTOMER
            try {
                const draftTargetEmail = process.env.TARGET_MAILBOX_EMAIL!;
                const customerDraftBody = `
                    <p>Dear Customer,</p>
                    <p>Thank you for reaching out to Indigo. We have received your complaint: <i>"${extraction.grid.complaint || complaint.subject}"</i>.</p>
                    <p>However, we were unable to locate your flight details with the PNR provided: <b>${extractedPnr || 'None'}</b>.</p>
                    <p>To assist you further, please provide the correct 6-character PNR number. You can reply to this email or send us the details at your earliest convenience.</p>
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
    console.log(`[DEBUG] pollResolutions: ${folderId}`);
    const messages = await outlook.getEmailsFromFolder(targetEmail, folderId, 10);
    console.log(`[DEBUG] pollResolutions: Found ${messages.length} messages`);

    for (const msg of messages) {
        // Extract Case ID from subject
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

        // Get full email body
        const emailBody = (msg.body as any)?.content || msg.bodyPreview || '';

        // Parse grid from Base Ops email (Regex OR LLM)
        const parsedGrid = await agent.parseResolutionFromEmail(emailBody);

        if (!parsedGrid || !parsedGrid.action_taken || !parsedGrid.outcome) {
            console.warn(`Failed to parse grid or missing action_taken/outcome for ${complaintId}`);
            continue;
        }

        console.log(`Parsed grid from Base Ops: Action="${parsedGrid.action_taken}", Outcome="${parsedGrid.outcome}"`);

        // Merge with existing grid
        const currentGrid = complaint.investigationGrid as any as CompleteInvestigationGrid;
        const updatedGrid: CompleteInvestigationGrid = {
            ...currentGrid,
            action_taken: parsedGrid.action_taken,
            outcome: parsedGrid.outcome
        };

        // Get original complaint for context
        const originalMsg = complaint.conversation.find(c => c.messageType === MessageType.EMAIL);
        const originalBody = (originalMsg?.content as any)?.body || '';

        console.log(`[DEBUG] Agent 2 Context - Subject: ${complaint.subject}, Body Length: ${originalBody.length}, Preview: ${originalBody.substring(0, 100)}`);

        // Agent 2: Enhance grid with evaluation
        const enhancement = await agent.enhanceGridWithResolution(
            updatedGrid,
            { subject: complaint.subject, body: originalBody }
        );

        const finalGrid = enhancement.enhanced_grid as CompleteInvestigationGrid;

        // Determine status
        const newStatus = enhancement.status === 'RESOLVED' ? ResolutionStatus.RESOLVED : ResolutionStatus.FLAGGED;
        const mainStatus = newStatus === ResolutionStatus.RESOLVED ? ComplaintStatus.RESOLVED : ComplaintStatus.WAITING_OPS;

        // Color code
        let scoreColor = 'RED';
        if (finalGrid.confidence_score && finalGrid.confidence_score >= 80) scoreColor = 'GREEN';
        else if (finalGrid.confidence_score && finalGrid.confidence_score >= 60) scoreColor = 'YELLOW';

        console.log(`Agent 2 Evaluation: ${enhancement.status} (Confidence: ${finalGrid.confidence_score}) - ${scoreColor}`);

        // Update DB with final grid
        await prisma.complaint.update({
            where: { id: complaintId },
            data: {
                investigationGrid: finalGrid as any,
                resolutionStatus: newStatus,
                crReviewStatus: 'PENDING',
                status: mainStatus
            }
        });

        // Add Base Ops response to conversation
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

        // Create Draft Response to CX with grid + prose
        if (enhancement.draft_response) {
            const draftTargetEmail = process.env.TARGET_MAILBOX_EMAIL!;

            const finalGridHtml = agent.formatGridAsHtmlTable(finalGrid);

            const htmlBody = `
                <p>Dear Customer,</p>
                <p>We have completed the investigation regarding your complaint: <strong>${complaint.subject}</strong>.</p>
                
                <hr style="border: 1px dashed #ccc; margin: 20px 0;">
                
                ${finalGridHtml}
                
                <hr style="border: 1px dashed #ccc; margin: 20px 0;">

                <p>${enhancement.draft_response}</p>

                <p>Sincerely,<br/>
                <strong>Indigo Customer Relations</strong><br/>
                <span style="font-size: 10px; color: #888;">Ref: ${complaint.id} | Score: ${finalGrid.confidence_score}%</span></p>
            `;

            await outlook.createDraft(
                draftTargetEmail,
                `[RESPONSE] Resolution for your complaint - ${complaint.subject} (PNR: ${finalGrid.pnr || 'N/A'})`,
                htmlBody
            );
            console.log(`Draft response created for CX (Score: ${finalGrid.confidence_score} - ${scoreColor}).`);
        }
    }
}

runWorker();
