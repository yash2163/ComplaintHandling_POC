import prisma from '../services/db';

async function checkGrid() {
    const complaint = await prisma.complaint.findFirst({
        where: {
            OR: [
                { resolutionStatus: 'FLAGGED' },
                { resolutionStatus: 'RESOLVED' }
            ]
        }
    });

    if (complaint) {
        console.log('Complaint ID:', complaint.id);
        console.log('Status:', complaint.status);
        console.log('Resolution Status:', complaint.resolutionStatus);
        console.log('\nInvestigation Grid:');
        console.log(JSON.stringify(complaint.investigationGrid, null, 2));
    } else {
        console.log('No resolved/flagged complaints found.');
    }

    await prisma.$disconnect();
}

checkGrid();
