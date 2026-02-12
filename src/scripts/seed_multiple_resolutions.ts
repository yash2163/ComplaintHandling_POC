import prisma from '../services/db';
import { OutlookService } from '../services/outlook';
import dotenv from 'dotenv';

dotenv.config();

async function injectMultipleResolutions() {
    const outlook = new OutlookService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL!;

    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');
    if (!resolutionsFolderId) {
        throw new Error('Resolutions folder not found');
    }

    // Wait briefly for worker to process complaints
    console.log('Waiting 5 seconds for worker to process complaints...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Find complaints with WAITING_OPS status
    const complaints = await prisma.complaint.findMany({
        where: { status: 'WAITING_OPS' },
        take: 5 // Process up to 5 complaints
    });

    if (complaints.length === 0) {
        console.log('No WAITING_OPS complaints found. Run the worker first to process complaints.');
        return;
    }

    console.log(`Found ${complaints.length} complaints awaiting resolution. Injecting resolutions...`);

    // Resolution templates for different complaint types
    const resolutionTemplates = [
        {
            // Medical refund - Good resolution
            action: 'Verified the medical certificate provided by the passenger. Certificate is valid and issued by a recognized medical authority.',
            outcome: 'Full refund of INR 15,000 has been initiated to the original payment source. The amount will reflect in 5-7 working days.',
            comments: 'The passenger was very cooperative throughout the process. We wish them a speedy recovery.'
        },
        {
            // Service issue - Partial resolution
            action: 'Reviewed CCTV footage and staff logs. Ground staff behavior was within policy but tone could have been better. Seat recline mechanism was found defective.',
            outcome: 'Issued apology letter to customer. Provided 2000 bonus miles as goodwill gesture. Seat has been repaired for future flights.',
            comments: 'Conducted refresher training for ground staff on customer empathy.'
        },
        {
            // Theft/damage - Investigation ongoing
            action: 'Initiated investigation with ground handling agencies at LHR and DEL. Reviewed baggage handling logs and security footage.',
            outcome: 'Investigation is ongoing. Passenger has been asked to file police report and insurance claim. We are cooperating fully with authorities.',
            comments: 'No evidence of internal theft found so far. Damage appears to be from rough handling during transfer.'
        },
        {
            // Flight cancellation - Full compensation
            action: 'Flight was cancelled due to technical issue with aircraft discovered during pre-flight check. Safety protocol mandates grounding.',
            outcome: 'Full refund of INR 8,500 processed. Additional compensation of INR 5,000 issued as per DGCA guidelines. Alternative flight booking offered but declined.',
            comments: 'Customer service team should have proactively offered alternatives. Process gap identified and being addressed.'
        },
        {
            // Web check-in failure - System issue acknowledged
            action: 'Verified system logs. Website experienced downtime from 10:15 AM to 11:30 AM on Feb 10 due to server maintenance. Rs 500 airport check-in fee was incorrectly charged.',
            outcome: 'Full refund of Rs 500 initiated to original payment method. Additionally, 1500 bonus miles credited as apology for inconvenience.',
            comments: 'IT team has been directed to schedule maintenance during off-peak hours.'
        }
    ];

    for (let i = 0; i < complaints.length && i < resolutionTemplates.length; i++) {
        const complaint = complaints[i];
        const resolution = resolutionTemplates[i];
        const grid = complaint.investigationGrid as any;
        const pnr = grid?.pnr || 'UNKNOWN';

        console.log(`Injecting resolution ${i + 1}/${complaints.length} for Case ${complaint.id} (PNR: ${pnr})...`);

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
Action Taken: ${resolution.action}
Outcome: ${resolution.outcome}
=== END GRID ===`;

        const resolutionBody = `
Dear CR Team,

We have completed the investigation for PNR ${pnr}.

${resolutionGridText}

Additional Comments: ${resolution.comments}

Regards,
Base Ops Team
        `;

        await outlook.createMessageInFolder(
            targetEmail,
            resolutionsFolderId,
            `Re: [ACTION REQUIRED] Investigation Request: ${complaint.subject} - PNR: ${pnr} [Case: ${complaint.id}]`,
            resolutionBody
        );

        console.log(`✓ Injected resolution for Case ${complaint.id}`);
    }

    console.log(`\nSuccessfully injected ${complaints.length} resolution emails!`);
}

injectMultipleResolutions()
    .catch(console.error)
    .finally(() => process.exit(0));
