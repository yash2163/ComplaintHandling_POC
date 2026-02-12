import prisma from '../services/db';
import { OutlookService } from '../services/outlook';
import { AgentService } from '../services/agent';
import dotenv from 'dotenv';

dotenv.config();

/*
 * Master seed script: Clears DB & Outlook, seeds passengers,
 * injects diverse complaints using VALID PNRs (ABC123, XYZ789, LMN456),
 * waits for Agent 1 processing, then injects HTML-formatted resolution emails.
 *
 * Valid Passengers:
 *   ABC123 - John Doe    - 6E-501 - 12A - DEL → BOM
 *   XYZ789 - Jane Smith  - 6E-202 - 15C - BLR → DEL
 *   LMN456 - Robert Brown - 6E-101 - 4D  - LHR → DEL
 */

async function main() {
    const outlook = new OutlookService();
    const agent = new AgentService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL!;

    const complaintsFolderId = await outlook.getFolderId(targetEmail, 'Complaints');
    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');
    if (!complaintsFolderId || !resolutionsFolderId) throw new Error('Outlook folders not found');

    // ── Step 1: Clear everything ──────────────────────────────────
    console.log('🗑️  Clearing database...');
    await prisma.conversationMessage.deleteMany({});
    await prisma.complaint.deleteMany({});
    await prisma.passenger.deleteMany({});

    console.log('🗑️  Clearing Outlook folders...');
    await outlook.clearFolder(targetEmail, complaintsFolderId);
    await outlook.clearFolder(targetEmail, resolutionsFolderId);

    // ── Step 2: Seed passengers ───────────────────────────────────
    console.log('👤 Seeding passengers...');
    const passengers = [
        { pnr: 'ABC123', customerName: 'John Doe', flightNumber: '6E-501', seatNumber: '12A', source: 'DEL', destination: 'BOM' },
        { pnr: 'XYZ789', customerName: 'Jane Smith', flightNumber: '6E-202', seatNumber: '15C', source: 'BLR', destination: 'DEL' },
        { pnr: 'LMN456', customerName: 'Robert Brown', flightNumber: '6E-101', seatNumber: '4D', source: 'LHR', destination: 'DEL' },
    ];
    for (const p of passengers) {
        await prisma.passenger.upsert({ where: { pnr: p.pnr }, update: p, create: p });
    }

    // ── Step 3: Inject 6 diverse complaints (only valid PNRs) ────
    const complaints = [
        {
            subject: 'Urgent Medical Refund Request - PNR: ABC123',
            body: `Dear Indigo,\n\nI am writing regarding PNR ABC123. I, John Doe, was booked on flight 6E-501 from Delhi to Mumbai on Feb 10th, seat 12A. Unfortunately, I was hospitalized due to a sudden cardiac arrest the night before my flight. I have a medical certificate from AIIMS Delhi. I am requesting a full refund of INR 15,000 as I could not travel. Please process this urgently.\n\nRegards,\nJohn Doe`,
        },
        {
            subject: 'Rude Ground Staff and Broken Seat - PNR: XYZ789',
            body: `Hello Indigo,\n\nI am extremely disappointed with my experience on flight 6E-202 from Bangalore to Delhi. My PNR is XYZ789, and I was seated at 15C. The ground staff at Bangalore airport were incredibly rude when I asked a simple question about boarding. Additionally, my seat 15C had a broken recline mechanism - it would not recline at all during a 3-hour flight.\n\nI expect proper action.\n\nJane Smith`,
        },
        {
            subject: 'Stolen Laptop and Torn Luggage - PNR: LMN456',
            body: `Dear Sir/Madam,\n\nI recently traveled on flight 6E-101 from London to Delhi (PNR: LMN456). Upon collecting my checked baggage, I discovered that my bag was severely torn and my Dell laptop (worth INR 85,000) was missing from inside. The zip lock was also broken. I suspect theft during baggage handling. This is a very serious matter.\n\nRobert Brown\nSeat 4D`,
        },
        {
            subject: 'Flight Cancelled Without Notice - PNR: ABC123',
            body: `To Whom It May Concern,\n\nMy flight 6E-501 (PNR: ABC123) from Delhi to Mumbai scheduled for Feb 11th was cancelled without any prior notification. I only found out when I reached the airport at 5 AM! No alternative flight was offered and the counter staff simply told me to "check the website." I had an important business meeting that I missed entirely. I demand full compensation.\n\nJohn Doe`,
        },
        {
            subject: 'Overcharged for Extra Baggage - PNR: XYZ789',
            body: `Hello,\n\nI am Jane Smith, PNR XYZ789, flight 6E-202 BLR to DEL. I was charged Rs 3,500 for "excess baggage" at the airport counter. However, my luggage weighed only 18 kg - well within the 23 kg limit for my booking class. The counter staff refused to re-weigh and insisted I pay or leave the bag. I have a photo of the scale showing 18 kg. Please refund the incorrect charge immediately.\n\nJane Smith`,
        },
        {
            subject: 'Wheelchair Not Provided at Arrival - PNR: LMN456',
            body: `Dear Indigo Customer Care,\n\nI am writing on behalf of my father Robert Brown (PNR: LMN456, flight 6E-101, seat 4D, London to Delhi). We had specifically requested wheelchair assistance at Delhi airport as my father has severe arthritis and cannot walk long distances. Despite confirming this twice before the flight, NO wheelchair was available at Delhi. My 72-year-old father had to walk over 800 meters to the exit. This is completely unacceptable and could have caused a serious medical incident.\n\nRobert Brown's Son`,
        },
    ];

    console.log('📧 Injecting 6 complaints...');
    for (let i = 0; i < complaints.length; i++) {
        await outlook.createMessageInFolder(targetEmail, complaintsFolderId, complaints[i].subject, complaints[i].body);
        console.log(`  ✓ ${i + 1}/6 ${complaints[i].subject}`);
    }

    // ── Step 4: Wait for worker to process (Agent 1) ─────────────
    console.log('\n⏳ Waiting 40 seconds for worker to process complaints...');
    await new Promise(r => setTimeout(r, 40000));

    const waiting = await prisma.complaint.findMany({
        where: { status: 'WAITING_OPS' },
        orderBy: { createdAt: 'asc' },
    });

    if (waiting.length === 0) {
        console.log('⚠️  No WAITING_OPS complaints yet. Run again in 30 seconds or check worker logs.');
        return;
    }

    console.log(`\n✅ ${waiting.length} complaints ready. Injecting HTML resolution emails...\n`);

    // ── Step 5: Inject HTML-formatted resolution emails ──────────
    // Mix of EXCELLENT / AVERAGE / POOR resolutions
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
            agent_reasoning: null,
        };

        const gridHtml = agent.formatGridAsHtmlTable(updatedGrid as any);
        const pnr = grid.pnr || 'N/A';

        const body = `
<p>Dear CR Team,</p>
<p>We have completed the investigation for <strong>PNR ${pnr}</strong>.</p>
<hr style="border: 1px dashed #ccc; margin: 20px 0;">
${gridHtml}
<hr style="border: 1px dashed #ccc; margin: 20px 0;">
<p>Best regards,<br/><strong>Base Operations Team</strong></p>
`;

        await outlook.createMessageInFolder(
            targetEmail,
            resolutionsFolderId,
            `Re: [ACTION REQUIRED] Investigation Request: ${complaint.subject} - PNR: ${pnr} [Case: ${complaint.id}]`,
            body,
        );

        console.log(`  ✓ Resolution ${i + 1} (${res.label}): PNR ${pnr} — ${complaint.subject.substring(0, 50)}...`);
    }

    console.log('\n🎉 Done! Summary:');
    console.log(`   Complaints injected : 6`);
    console.log(`   Resolutions injected: ${Math.min(waiting.length, resolutions.length)}`);
    console.log('   Quality mix: 2 EXCELLENT · 2 AVERAGE · 2 POOR');
    console.log('\n   Agent 2 will evaluate these in ~30 seconds.');
}

main().catch(console.error).finally(() => process.exit(0));
