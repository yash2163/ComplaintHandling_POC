import prisma from '../services/db';

async function check() {
    const c = await prisma.complaint.findFirst({
        where: { subject: { contains: 'Missing Baggage' } },
        include: { conversation: true }
    });

    if (!c) {
        console.log("Complaint NOT FOUND");
        return;
    }

    console.log(`Found Complaint: ${c.id}`);
    console.log(`Status: ${c.status}`);
    console.log(`Origin: ${c.originStation}`);

    const grid = c.conversation.find((m: any) => m.messageType === 'GRID');
    console.log(`Grid Message Exists: ${!!grid}`);
    if (grid) {
        console.log(JSON.stringify(grid.content, null, 2));
    }
}

check();
