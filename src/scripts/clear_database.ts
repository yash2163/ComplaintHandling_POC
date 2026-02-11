import prisma from '../services/db';
import dotenv from 'dotenv';
dotenv.config();

async function clearDatabase() {
    console.log('Clearing all data from database...');

    // Delete in correct order (respecting foreign key constraints)
    await prisma.conversationMessage.deleteMany();
    await prisma.complaint.deleteMany();
    await prisma.passenger.deleteMany();

    console.log('Database cleared successfully!');
}

clearDatabase()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
