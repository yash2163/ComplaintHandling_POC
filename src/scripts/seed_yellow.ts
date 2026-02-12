import prisma from '../services/db';
import { OutlookService } from '../services/outlook';
import { AgentService } from '../services/agent';
import { ComplaintStatus } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function seedYellow() {
    const outlook = new OutlookService();
    const agent = new AgentService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL!;

    const complaintsFolderId = await outlook.getFolderId(targetEmail, 'Complaints');
    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');

    // 1. Inject Complaint
    const c = {
        pnr: 'ABC123',
        subject: 'Pre-booked Meal Not Served - PNR: ABC123',
        body: `Hi, I pre-booked a Veg Jungle Sandwich for my flight 6E-501 (DEL-BOM). When meal service started, the crew told me they ran out of it and offered me cup noodles instead. I refused. I want my money back and compensation for staying hungry.\n\nJohn Doe`,
    };

    console.log(`📧 Injecting Yellow Target Complaint: ${c.subject}`);
    await outlook.createMessageInFolder(targetEmail, complaintsFolderId!, c.subject, c.body);

    console.log('\n⏳ Waiting 45 seconds for Worker...');
    await new Promise(r => setTimeout(r, 45000));

    // 2. Fetch
    const pending = await prisma.complaint.findMany({
        where: {
            status: ComplaintStatus.WAITING_OPS,
            subject: c.subject
        }
    });

    if (pending.length === 0) {
        console.log('⚠️ Complaint not picked up yet.');
        return;
    }

    const complaint = pending[0];

    // 3. Inject "Okay" Resolution
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
    console.log(`  ✓ Resolution Injected: ${c.subject}`);
    console.log('\n✅ Done! Check logs/dashboard for score.');
}

seedYellow().catch(console.error).finally(() => process.exit(0));
