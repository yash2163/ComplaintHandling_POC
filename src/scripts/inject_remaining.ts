import prisma from '../services/db';
import { OutlookService } from '../services/outlook';
import { AgentService } from '../services/agent';
import dotenv from 'dotenv';
dotenv.config();

async function injectRemaining() {
    const outlook = new OutlookService();
    const agent = new AgentService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL!;
    const resId = await outlook.getFolderId(targetEmail, 'Resolutions');

    const waiting = await prisma.complaint.findMany({
        where: { status: 'WAITING_OPS' },
        orderBy: { createdAt: 'asc' }
    });

    console.log(`Remaining WAITING_OPS: ${waiting.length}`);

    const resolutions = [
        {
            // Medical refund → EXCELLENT
            action: 'Verified medical certificate from AIIMS Delhi. Certificate is authentic, issued by Dr. R. K. Sharma (Reg. No. 12345). Diagnosis confirms cardiac event requiring hospitalization on Feb 9th.',
            outcome: 'Full refund of INR 15,000 processed to original payment method. Refund will reflect within 24-48 hours. All cancellation fees waived under medical emergency policy. Complimentary rebooking offered for any future date.',
            label: 'EXCELLENT',
        },
        {
            // Rude staff + broken seat → AVERAGE
            action: 'Reviewed CCTV footage from BLR airport check-in area. Staff member\'s tone was curt but not abusive. Seat 15C inspected: recline mechanism spring was indeed broken, confirmed by maintenance log.',
            outcome: 'Formal apology issued to passenger. Seat 15C repaired and cleared for future flights. 2,000 bonus miles credited as goodwill. Staff member given verbal counseling on customer interaction.',
            label: 'AVERAGE',
        },
        {
            // Stolen laptop + torn luggage → POOR
            action: 'Opened investigation with ground handling agency at LHR and DEL. Reviewed CCTV from baggage belt area. Footage is inconclusive due to camera angle.',
            outcome: 'Unable to confirm theft at this time. Passenger advised to file FIR with local police and claim through travel insurance. Compensation of Rs 2,000 offered for damaged bag only. Laptop claim denied due to insufficient evidence.',
            label: 'POOR',
        },
        {
            // Flight cancelled → EXCELLENT
            action: 'Confirmed flight 6E-501 was cancelled due to severe fog at DEL (visibility below 50m). All passengers were notified via SMS at 3:15 AM. Checked passenger notification logs - SMS delivery to registered mobile confirmed.',
            outcome: 'Full ticket refund of INR 8,200 processed. Additional compensation of INR 5,000 as per DGCA norms for cancellation within 24 hours. Free rebooking on next available flight offered. Hotel voucher for INR 2,000 issued.',
            label: 'EXCELLENT',
        },
        {
            // Overcharged baggage → AVERAGE
            action: 'Checked airport weighing scale calibration records. Scale at counter 7 (BLR Terminal 1) was last calibrated 45 days ago - overdue for quarterly calibration. Passenger\'s photo evidence reviewed and appears credible.',
            outcome: 'Refund of Rs 3,500 overcharge initiated. Will reflect in 7-10 business days. BLR airport team directed to recalibrate all scales immediately. No additional compensation provided.',
            label: 'AVERAGE',
        },
        {
            // Wheelchair not provided → POOR
            action: 'Checked PRM (Persons with Reduced Mobility) database. Wheelchair request was logged but marked as "optional" in system due to data entry error. Ground handling team at DEL was not notified.',
            outcome: 'Apology letter sent. 1,000 bonus miles credited. Ground staff reminded about PRM protocols. No monetary compensation offered as per current policy for service gaps.',
            label: 'POOR',
        },
    ];

    for (let i = 0; i < waiting.length && i < resolutions.length; i++) {
        const complaint = waiting[i];
        const res = resolutions[i];
        const grid = complaint.investigationGrid as any;
        if (!grid) continue;

        const updatedGrid = {
            ...grid,
            action_taken: res.action,
            outcome: res.outcome,
            agent_summary: null,
            confidence_score: null,
            agent_reasoning: null
        };

        const gridHtml = agent.formatGridAsHtmlTable(updatedGrid as any);
        const pnr = grid.pnr || 'N/A';

        const body = `
<p>Dear CR Team,</p>
<p>Investigation completed for <strong>PNR ${pnr}</strong>.</p>
<hr style="border: 1px dashed #ccc; margin: 20px 0;">
${gridHtml}
<hr style="border: 1px dashed #ccc; margin: 20px 0;">
<p>Best regards,<br/><strong>Base Operations Team</strong></p>
`;

        await outlook.createMessageInFolder(
            targetEmail,
            resId!,
            `Re: [ACTION REQUIRED] Investigation Request: ${complaint.subject} - PNR: ${pnr} [Case: ${complaint.id}]`,
            body
        );
        console.log(`✓ Resolution (${res.label}): PNR ${pnr}`);
    }
    console.log('Done!');
}

injectRemaining().catch(console.error).finally(() => process.exit(0));
