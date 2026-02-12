import prisma from '../services/db';
import { OutlookService } from '../services/outlook';
import { AgentService } from '../services/agent';
import { ComplaintStatus } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function checkAndInject() {
    const outlook = new OutlookService();
    const agent = new AgentService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL!;
    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');

    const targets = [
        { subject: 'Flight Delayed 5 Hours - PNR: XYZ789', key: 'Delayed' },
        { subject: 'Dirty Tray Table - PNR: LMN456', key: 'Dirty' }
    ];

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

    for (const t of targets) {
        const complaints = await prisma.complaint.findMany({
            where: { subject: t.subject },
            orderBy: { createdAt: 'desc' },
            take: 1
        });

        if (complaints.length === 0) {
            console.log(`❌ Complaint not found in DB: ${t.subject}`);
            continue;
        }

        const c = complaints[0];
        console.log(`Found ${c.subject} (Status: ${c.status})`);

        if (c.status === 'NEW') {
            console.log('  ⚠️ Still NEW, waiting for Agent 1...');
            continue;
        }

        if (c.resolutionStatus !== 'PENDING') {
            const grid = c.investigationGrid as any;
            console.log(`  ✅ Already Solved. Score: ${grid?.confidence_score}`);
            continue;
        }

        // Check if resolution already sent (by checking grid content usually, but here we just re-inject if needed or check logs)
        // We'll trust the process: if it's WAITING_OPS, we send resolution.
        // But if we already sent it, sending again might confuse? 
        // Agent 2 processes every email in Resolution folder.

        console.log(`  📧 Injecting Resolution for ${c.subject}...`);

        const res = resolutionsMap[t.key];
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
        console.log(`  ✓ Resolution Sent!`);
    }
}

checkAndInject().catch(console.error).finally(() => process.exit(0));
