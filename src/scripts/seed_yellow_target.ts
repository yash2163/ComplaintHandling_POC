import prisma from '../services/db';
import { OutlookService } from '../services/outlook';
import { AgentService } from '../services/agent';
import { ComplaintStatus } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function seedYellowTarget() {
    const outlook = new OutlookService();
    const agent = new AgentService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL!;

    const complaintsFolderId = await outlook.getFolderId(targetEmail, 'Complaints');
    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');

    // 1. Inject Complaints
    const cases = [
        {
            pnr: 'XYZ789',
            subject: 'Flight Delayed 5 Hours - PNR: XYZ789',
            body: `My flight 6E-202 was delayed by 5 hours! I missed my connecting train. I want a full refund of my ticket cost immediately. This is unacceptable service.`,
        },
        {
            pnr: 'LMN456',
            subject: 'Dirty Tray Table - PNR: LMN456',
            body: `The tray table at seat 12A was sticky and had coffee stains when I boarded. I had to wipe it myself. The crew just gave me some tissues. I expect a travel voucher for this hygiene failure.`,
        }
    ];

    console.log('📧 Injecting 2 Yellow Target Complaints...');

    for (const c of cases) {
        await outlook.createMessageInFolder(targetEmail, complaintsFolderId!, c.subject, c.body);
        console.log(`  ✓ Injected: ${c.subject}`);
    }

    console.log('\n⏳ Waiting 45 seconds for Worker...');
    await new Promise(r => setTimeout(r, 45000));

    // 2. Fetch pending
    const pending = await prisma.complaint.findMany({
        where: {
            status: ComplaintStatus.WAITING_OPS,
            subject: { in: cases.map(c => c.subject) }
        }
    });

    if (pending.length === 0) {
        console.log('⚠️ No complaints found in WAITING_OPS.');
        return;
    }

    // 3. Inject "Partial" Resolutions
    // Strategy: Compliance with policy but not satisfying customer demands -> Partial
    const resolutionsMap: Record<string, any> = {
        'Delayed': {
            action: 'Flight delay confirmed due to bad weather at destination (Force Majeure). Standard Operating Procedure followed.',
            outcome: 'Refund request denied as delay was weather-related. Complimentary snacks and beverages provided to passengers at the gate. Apology email sent.',
            label: 'PARTIAL (Yellow Target)'
        },
        'Dirty': {
            action: 'Spoke to cabin crew lead. Confirmed passenger was given wet wipes to clean the tray. Cleaning agency at previous station has been flagged.',
            outcome: 'Apology offered for the inconvenience. 500 bonus miles credited as a gesture of goodwill. No travel voucher issued.',
            label: 'PARTIAL (Yellow Target)'
        }
    };

    console.log('\n📧 Injecting Resolutions...');

    for (const c of pending) {
        let res = null;
        for (const key in resolutionsMap) {
            if (c.subject.includes(key)) {
                res = resolutionsMap[key];
                break;
            }
        }

        if (!res) continue;

        const grid = c.investigationGrid as any;
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
            resolutionsFolderId!,
            `Re: [ACTION REQUIRED] Investigation Request: ${c.subject} - PNR: ${pnr} [Case: ${c.id}]`,
            body
        );
        console.log(`  ✓ Resolution Injected: ${c.subject}`);
    }
}

seedYellowTarget().catch(console.error).finally(() => process.exit(0));
