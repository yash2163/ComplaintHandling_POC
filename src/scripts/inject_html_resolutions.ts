import prisma from '../services/db';
import { OutlookService } from '../services/outlook';
import { AgentService } from '../services/agent';
import dotenv from 'dotenv';

dotenv.config();

async function injectHtmlResolutionsForExisting() {
    const outlook = new OutlookService();
    const agent = new AgentService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL!;

    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');

    if (!resolutionsFolderId) {
        throw new Error('Resolutions folder not found');
    }

    // Find complaints awaiting Base Ops action
    const complaints = await prisma.complaint.findMany({
        where: {
            status: 'WAITING_OPS'
        },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    if (complaints.length === 0) {
        console.log('⚠️ No complaints in WAITING_OPS status found.');
        return;
    }

    console.log(`✅ Found ${complaints.length} complaints in WAITING_OPS. Injecting HTML resolution emails...\n`);

    // Resolution templates with mixed quality
    const resolutionTemplates = [
        {
            action: 'Verified flight logs and passenger medical documentation. Certificate issued by accredited hospital and validates emergency medical condition requiring immediate travel cancellation.',
            outcome: 'Full refund of INR 12,500 processed to original payment method within 24 hours. All cancellation fees waived due to valid medical emergency. Passenger also offered complimentary priority rebooking assistance.',
            quality: 'EXCELLENT'
        },
        {
            action: 'Reviewed security footage and crew reports. Multiple passengers complained about similar rude behavior. Staff member violated service protocol by ignoring customer request.',
            outcome: 'Staff member issued written warning and suspended for 1 week. Customer receives 3000 bonus miles and formal apology letter. Refresher training mandatory for all crew.',
            quality: 'EXCELLENT'
        },
        {
            action: 'Checked baggage tracking system. Bag was misrouted due to similar tag number. Located at alternate airport 200km away.',
            outcome: 'Baggage delivered to customer address within 18 hours. Compensation of Rs 1200 provided for inconvenience. No items reported missing or damaged.',
            quality: 'AVERAGE'
        },
        {
            action: 'Investigated check-in system logs. Website experienced server overload during peak booking hours. System auto-downgraded some passengers without notification.',
            outcome: 'Refund of seat selection fee (Rs 500) processed. Additionally, 1000 bonus miles credited. IT team working on fix to prevent auto-downgrades.',
            quality: 'AVERAGE'
        },
        {
            action: 'Reviewed complaint. Customer claims staff was dismissive but provided no specific details. No witness statements or evidence available.',
            outcome: 'Unable to verify claims without concrete evidence. Issued 500 bonus miles as goodwill. General reminder sent to ground staff about professional conduct.',
            quality: 'POOR'
        }
    ];

    for (let i = 0; i < complaints.length && i < resolutionTemplates.length; i++) {
        const complaint = complaints[i];
        const resolution = resolutionTemplates[i];
        const grid = complaint.investigationGrid as any;
        const pnr = grid?.pnr || 'UNKNOWN';

        console.log(`Processing complaint ${i + 1}/${complaints.length}: Case ${complaint.id.substring(0, 8)} (PNR: ${pnr})`);

        // Create updated grid with resolution
        const updatedGrid = {
            pnr: grid.pnr || '-',
            customer_name: grid.customer_name || '-',
            flight_number: grid.flight_number || '-',
            seat_number: grid.seat_number || '-',
            source: grid.source || '-',
            destination: grid.destination || '-',
            complaint: grid.complaint || '-',
            issue_type: grid.issue_type || '-',
            weather_condition: grid.weather_condition || '-',
            date: grid.date || '-',
            action_taken: resolution.action,
            outcome: resolution.outcome,
            agent_summary: null,
            confidence_score: null,
            agent_reasoning: null
        };

        // Generate HTML table using the agent service
        const gridHtml = agent.formatGridAsHtmlTable(updatedGrid as any);

        const resolutionBody = `
<p>Dear CR Team,</p>
<p>We have completed the investigation for <strong>PNR ${updatedGrid.pnr}</strong>.</p>

<hr style="border: 1px dashed #ccc; margin: 20px 0;">

${gridHtml}

<hr style="border: 1px dashed #ccc; margin: 20px 0;">

<p><strong>Resolution Quality:</strong> ${resolution.quality}</p>
<p><em>Please review the investigation grid above and proceed with final response to customer.</em></p>

<p>Best regards,<br/>
<strong>Base Operations Team</strong></p>
        `;

        await outlook.createMessageInFolder(
            targetEmail,
            resolutionsFolderId,
            `Re: [ACTION REQUIRED] Investigation Request: ${complaint.subject} - PNR: ${pnr} [Case: ${complaint.id}]`,
            resolutionBody
        );

        console.log(`✓ HTML Resolution injected (${resolution.quality}): Case ${complaint.id.substring(0, 8)}`);
    }

    console.log(`\n🎉 Successfully injected ${complaints.length} HTML-formatted resolution emails!`);
    console.log('\n📊 Quality Distribution:');
    console.log('   - EXCELLENT: 2 resolutions');
    console.log('   - AVERAGE: 2 resolutions');
    console.log('   - POOR: 1 resolution');
    console.log('\n✅ Check Outlook Resolutions folder to see the HTML table format!');
    console.log('⏳ Agent 2 will process these in ~30 seconds and evaluate the resolutions.');
}

injectHtmlResolutionsForExisting()
    .catch(console.error)
    .finally(() => process.exit(0));
