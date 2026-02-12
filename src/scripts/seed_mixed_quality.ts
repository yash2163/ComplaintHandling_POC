import prisma from '../services/db';
import { OutlookService } from '../services/outlook';
import { AgentService } from '../services/agent';
import { AuthorType, ComplaintStatus, ResolutionStatus } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function seedMixedQuality() {
    const outlook = new OutlookService();
    const agent = new AgentService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL!;

    const complaintsFolderId = await outlook.getFolderId(targetEmail, 'Complaints');
    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');

    // 1. Inject Complaints
    const mixedComplaints = [
        {
            pnr: 'XYZ789', // Jane Smith
            subject: 'In-flight Entertainment Not Working - PNR: XYZ789',
            body: `Hi, I flew on 6E-202 (BLR-DEL) yesterday. The IFE screen at seat 15C was completely black for the entire 3-hour flight. I asked the crew to reset it, but they said they couldn't. I was very bored and disappointed as I had planned to watch a movie. I expect some compensation for this lack of service.\n\nJane Smith`,
            quality: 'AVERAGE (Yellow)'
        },
        {
            pnr: 'LMN456', // Robert Brown
            subject: 'Damaged Stroller - PNR: LMN456',
            body: `To Indigo Support,\nMy brand new stroller was gate-checked on flight 6E-101. When I received it at Delhi, the wheel was bent and the fabric was torn. This stroller cost me $400. I have attached photos of the damage. I need a replacement or full reimbursement immediately.\n\nRobert`,
            quality: 'POOR (Red)'
        }
    ];

    console.log('📧 Injecting 2 Mixed Quality Complaints...');

    // We need to track these specifically to inject resolutions later
    // For simplicity in this script, we'll inject, wait for worker, then inject resolution

    for (const c of mixedComplaints) {
        await outlook.createMessageInFolder(targetEmail, complaintsFolderId!, c.subject, c.body);
        console.log(`  ✓ Injected: ${c.subject}`);
    }

    console.log('\n⏳ Waiting 45 seconds to ensure Worker picks them up...');
    await new Promise(r => setTimeout(r, 45000));

    // 2. Fetch the newly created complaints from DB
    // We look for WAITING_OPS status and matching subjects
    const pending = await prisma.complaint.findMany({
        where: {
            status: ComplaintStatus.WAITING_OPS,
            subject: { in: mixedComplaints.map(c => c.subject) }
        }
    });

    if (pending.length === 0) {
        console.log('⚠️ No WAITING_OPS complaints found. Worker might be slow or not running.');
        return;
    }

    // 3. Inject Resolutions
    const resolutionsMap: Record<string, any> = {
        'Entertainment': {
            // AVERAGE: Acknowledges issue but minimal effort/compensation (template response)
            action: 'Checked maintenance log. IFE system reported intermittent issues on that aircraft. Crew did not report specific seat failure.',
            outcome: 'Apology email sent to customer. No compensation provided as IFE is a complimentary service on this sector. Feedback logged for engineering team.',
            label: 'AVERAGE'
        },
        'Stroller': {
            // POOR: Dismissive, citing policy to avoid paying, ignoring evidence
            action: 'Reviewed baggage handling report. Stroller was checked in as "Limited Release" tag.',
            outcome: 'Claim denied. Limited Release tag exempts airline from liability for minor damage to stroller wheels or fabric. Customer advised to contact manufacturer.',
            label: 'POOR'
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
            // Ensure these are null so Agent 2 fills them
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
        console.log(`  ✓ Resolution (${res.label}): ${c.subject}`);
    }

    console.log('\n✅ Done! Check dashboard in ~30s for Yellow/Red scores.');
}

seedMixedQuality().catch(console.error).finally(() => process.exit(0));
