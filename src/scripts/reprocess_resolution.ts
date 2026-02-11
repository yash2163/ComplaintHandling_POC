import prisma from '../services/db';
import { AgentService } from '../services/agent';
import dotenv from 'dotenv';
dotenv.config();

async function reprocessResolution() {
    console.log('Reprocessing resolution with updated code...\n');

    // Find the RESO99 complaint
    const complaint = await prisma.complaint.findFirst({
        where: { pnr: 'RESO99' },
        include: { conversation: true }
    });

    if (!complaint) {
        console.log('RESO99 complaint not found!');
        return;
    }

    console.log(`Found complaint: ${complaint.id}`);
    console.log(`Current status: ${complaint.resolutionStatus}`);
    console.log(`Current action: ${complaint.resolutionAction || 'NULL'}`);
    console.log(`Current outcome: ${complaint.resolutionOutcome || 'NULL'}\n`);

    // Simulate what Agent 2 would do
    const emailMsg = complaint.conversation.find(c => c.messageType === 'EMAIL');
    const originalBody = (emailMsg?.content as any)?.body || '';

    const crewResponse = {
        subject: `[Case: ${complaint.id}] Re: Investigation`,
        body: `
        Hi Team,
        
        We have inspected the baggage for passenger Alice Validation (PNR: RESO99).
        Confirmed that the handle was damaged during transit. 
        However, the bag was already tagged as 'Fragile - Limited Release', so liability is limited.
        We can offer a voucher of 500 INR as a goodwill gesture.
        
        Regards,
        Station Manager, DEL
        `
    };

    const agent = new AgentService();
    const evaluation = await agent.evaluateResolution(
        { subject: complaint.subject, body: originalBody },
        crewResponse
    );

    console.log('New Agent 2 Evaluation:');
    console.log('- Status:', evaluation.status);
    console.log('- Action:', evaluation.action_taken);
    console.log('- Outcome:', evaluation.outcome);
    console.log('');

    // Update database with NEW fields
    await prisma.complaint.update({
        where: { id: complaint.id },
        data: {
            resolutionStatus: evaluation.status === 'RESOLVED' ? 'RESOLVED' : 'FLAGGED',
            agentReasoning: evaluation.reasoning,
            resolutionSummary: evaluation.summary,
            resolutionAction: evaluation.action_taken,
            resolutionOutcome: evaluation.outcome,
            status: evaluation.status === 'RESOLVED' ? 'RESOLVED' : 'WAITING_OPS'
        }
    });

    console.log('✅ Database updated with new fields!');
}

reprocessResolution()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
