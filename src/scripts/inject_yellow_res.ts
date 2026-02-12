import prisma from '../services/db';
import { OutlookService } from '../services/outlook';
import { AgentService } from '../services/agent';
import { ComplaintStatus } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function injectYellowRes() {
    const outlook = new OutlookService();
    const agent = new AgentService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL!;
    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');

    // Fetch the complaint
    const pending = await prisma.complaint.findMany({
        where: {
            status: ComplaintStatus.WAITING_OPS,
            subject: 'Pre-booked Meal Not Served - PNR: ABC123'
        }
    });

    if (pending.length === 0) {
        console.log('⚠️ Complaint not found in WAITING_OPS.');
        return;
    }

    const complaint = pending[0];
    console.log(`Found complaint: ${complaint.id}`);

    // Inject "Okay" Resolution
    const res = {
        action: 'Verified meal booking manifest. Cabin crew report confirms Veg Sandwich was unavailable due to loading error by catering.',
        outcome: 'Refund of INR 350 (meal cost) processed to source account. Apologies for the inconvenience.',
        label: 'AVERAGE (Yellow Target)'
    };

    const grid = complaint.investigationGrid as any;
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
        `Re: [ACTION REQUIRED] Investigation Request: ${complaint.subject} - PNR: ${pnr} [Case: ${complaint.id}]`,
        body
    );
    console.log(`  ✓ Resolution Injected: ${complaint.subject}`);
}

injectYellowRes().catch(console.error).finally(() => process.exit(0));
