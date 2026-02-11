import prisma from '../services/db';
import { OutlookService } from '../services/outlook';
import dotenv from 'dotenv';

dotenv.config();

async function injectDynamicResolution() {
    const outlook = new OutlookService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL!;

    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');
    if (!resolutionsFolderId) {
        throw new Error('Resolutions folder not found');
    }

    // Find a complaint with WAITING_OPS status
    const complaint = await prisma.complaint.findFirst({
        where: { status: 'WAITING_OPS' }
    });

    if (!complaint) {
        console.log('No WAITING_OPS complaint found to inject resolution for.');
        return;
    }

    const grid = complaint.investigationGrid as any;
    const pnr = grid?.pnr || 'UNKNOWN';

    console.log(`Searching for complaint with PNR: ${pnr}...`);
    console.log(`Found Complaint ID: ${complaint.id}`);

    // Create structured text grid with resolution filled in
    const resolutionGridText = `=== INVESTIGATION GRID ===
PNR: ${grid.pnr || '-'}
Customer Name: ${grid.customer_name || '-'}
Flight Number: ${grid.flight_number || '-'}
Seat Number: ${grid.seat_number || '-'}
Source: ${grid.source || '-'}
Destination: ${grid.destination || '-'}
Complaint: ${grid.complaint || '-'}
Issue Type: ${grid.issue_type || '-'}
Weather Condition: ${grid.weather_condition || '-'}
Date: ${grid.date || '-'}
---
Action Taken: Verified the medical certificate provided by the passenger. Certificate is valid and issued by a recognized medical authority.
Outcome: Full refund of INR 15,000 has been initiated to the original payment source. The amount will reflect in 5-7 working days.
=== END GRID ===`;

    const resolutionBody = `
Dear CR Team,

We have completed the investigation for PNR ${pnr}.

${resolutionGridText}

Additional Comments: The passenger was very cooperative throughout the process. We wish them a speedy recovery.

Regards,
Base Ops Team
    `;

    await outlook.createMessageInFolder(
        targetEmail,
        resolutionsFolderId,
        `Re: [ACTION REQUIRED] Investigation Request: ${complaint.subject} - PNR: ${pnr} [Case: ${complaint.id}]`,
        resolutionBody
    );

    console.log(`Injected Resolution Email for Case ${complaint.id}`);
}

injectDynamicResolution()
    .catch(console.error)
    .finally(() => process.exit(0));
