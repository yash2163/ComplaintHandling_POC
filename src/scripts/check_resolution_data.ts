import prisma from '../services/db';

async function checkResolutionData() {
    console.log('Checking complaints with resolution data...\n');

    const complaints = await prisma.complaint.findMany({
        where: {
            resolutionStatus: {
                in: ['RESOLVED', 'FLAGGED']
            }
        },
        select: {
            id: true,
            subject: true,
            pnr: true,
            resolutionStatus: true,
            resolutionSummary: true,
            resolutionAction: true,
            resolutionOutcome: true,
            agentReasoning: true
        }
    });

    console.log(`Found ${complaints.length} resolved/flagged complaints:\n`);

    for (const c of complaints) {
        console.log('-----------------------------------');
        console.log(`ID: ${c.id}`);
        console.log(`Subject: ${c.subject}`);
        console.log(`PNR: ${c.pnr}`);
        console.log(`Status: ${c.resolutionStatus}`);
        console.log(`Summary: ${c.resolutionSummary || 'NULL'}`);
        console.log(`Action: ${c.resolutionAction || 'NULL'}`);
        console.log(`Outcome: ${c.resolutionOutcome || 'NULL'}`);
        console.log(`Reasoning: ${c.agentReasoning || 'NULL'}`);
        console.log('');
    }

    if (complaints.length === 0) {
        console.log('No resolutions found. Worker may not have processed resolution emails yet.');
    }
}

checkResolutionData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
