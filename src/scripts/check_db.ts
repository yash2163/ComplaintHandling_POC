import prisma from '../services/db';

async function checkDB() {
    const complaints = await prisma.complaint.findMany({
        include: {
            conversation: {
                orderBy: { createdAt: 'asc' }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    console.log('\n=== COMPLAINTS ===');
    for (const c of complaints) {
        console.log(`\nID: ${c.id.substring(0, 8)}...`);
        console.log(`Subject: ${c.subject}`);
        console.log(`Status: ${c.status}`);
        console.log(`Origin Station: ${c.originStation || 'NULL'}`);
        console.log(`Messages: ${c.conversation.length}`);

        for (const msg of c.conversation) {
            console.log(`  - ${msg.messageType} (${msg.authorType})`);
            if (msg.messageType === 'GRID') {
                const content = msg.content as any;
                console.log(`    Grid:`, JSON.stringify(content.gridFields, null, 2));
            }
        }
    }

    await prisma.$disconnect();
}

checkDB();
