import prisma from '../services/db';

async function check() {
    const c = await prisma.complaint.findFirst({
        where: { subject: { contains: 'Missing Baggage' } }
    });

    if (!c) {
        console.log("Complaint NOT FOUND");
        return;
    }

    console.log(`Found Complaint: ${c.id}`);
    console.log(`Resolution Status: ${c.resolutionStatus}`); // Should be RESOLVED
    console.log(`Main Status: ${c.status}`); // Should be RESOLVED or APPROVED? Check logic. 
    // Logic: const mainStatus = newStatus === ResolutionStatus.RESOLVED ? ComplaintStatus.RESOLVED : ComplaintStatus.WAITING_OPS;

    console.log(`Reasoning: ${c.agentReasoning}`);
    console.log(`Summary: ${c.resolutionSummary}`);
}

check();
