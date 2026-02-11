import prisma from '../services/db';
import { OutlookService } from '../services/outlook';
import dotenv from 'dotenv';
dotenv.config();

async function seedAndTest() {
    console.log('Clearing database and seeding Passenger data...');

    // Clear existing data to start fresh
    await prisma.conversationMessage.deleteMany();
    await prisma.complaint.deleteMany();

    // 1. Seed Passengers
    const passengers = [
        { pnr: 'ABC123', customerName: 'John Doe', flightNumber: '6E-501', seatNumber: '12A', source: 'DEL', destination: 'BOM' },
        { pnr: 'XYZ789', customerName: 'Jane Smith', flightNumber: '6E-202', seatNumber: '15C', source: 'BLR', destination: 'DEL' },
        { pnr: 'LMN456', customerName: 'Robert Brown', flightNumber: '6E-101', seatNumber: '4D', source: 'LHR', destination: 'DEL' }
    ];

    for (const p of passengers) {
        await prisma.passenger.upsert({ where: { pnr: p.pnr }, update: p, create: p });
    }

    console.log('Passengers seeded.');

    // 2. Inject Test Emails
    const outlook = new OutlookService();
    await outlook.authenticate();

    const targetEmail = process.env.TARGET_MAILBOX_EMAIL;
    if (!targetEmail) throw new Error("TARGET_MAILBOX_EMAIL not set");

    const complaintsFolderId = await outlook.getFolderId(targetEmail, 'Complaints');
    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');
    if (!complaintsFolderId || !resolutionsFolderId) throw new Error("Outlook folders not found");

    console.log('Clearing Outlook folders...');
    await outlook.clearFolder(targetEmail, complaintsFolderId);
    await outlook.clearFolder(targetEmail, resolutionsFolderId);

    const testComplaints = [
        {
            subject: "Urgent Medical Refund Request - PNR: ABC123",
            body: "To whom it may concern, I am writing to request a full refund for PNR ABC123. My passenger, John Doe, suffered a severe medical emergency this morning and is currently hospitalized. We were supposed to fly from Delhi to Mumbai. I can provide the discharge summary once available. Please expedite this as the situation is very stressful."
        },
        {
            subject: "Disgraceful Service and Seat Issue - 6E-202 (PNR: XYZ789)",
            body: "Hi Indigo, I recently flew from Bangalore to Delhi with Jane Smith (PNR: XYZ789). Not only was the ground staff at BLR incredibly rude when we asked for assistance, but Jane's seat (15C) was broken and wouldn't recline for the entire 3-hour journey. This is not the premium experience we paid for. I expect a formal apology and some form of compensation for the discomfort."
        },
        {
            subject: "Theft and Damage on 6E-101 - PNR: LMN456",
            body: "I am absolutely appalled. I landed in Delhi today from London (Robert Brown, PNR: LMN456) and found my expensive laptop missing from my checked-in luggage. Furthermore, the suitcase itself is torn from the side. This is a massive security breach and property damage. I want an immediate investigation into the ground handling at LHR and DEL."
        },
        {
            subject: "Problem with my flight",
            body: "Hi, I had a very bad experience on my flight yesterday. The food was cold and the Air hostess was not helpfull at all her name was rebeka. I want my money back. I don't have my ticket handy right now, can you look me up?"
        },
        {
            subject: "Flight Cancellation - No Alternative Offered (PNR: ABC123)",
            body: "Dear Indigo, Flight 6E-501 Delhi to Mumbai on Feb 10th was cancelled with only 2 hours notice. No alternative flight was offered to me. I had an important business meeting that I missed. This is extremely unprofessional. I demand a full refund plus compensation for the inconvenience caused. PNR: ABC123, passenger John Doe."
        },
        {
            subject: "Web Check-in Failed - Had to Pay Extra (PNR: XYZ789)",
            body: "I tried multiple times to do web check-in for flight 6E-202 (PNR XYZ789, passenger Jane Smith) but your website kept crashing. When I reached the airport, I was charged Rs 500 for airport check-in! This is not my fault. The system was down. I want a refund of this unfair charge."
        },
        {
            subject: "Overweight Baggage Dispute - PNR: LMN456",
            body: "Hello, I was traveling on 6E-101 from LHR to DEL yesterday (Robert Brown, PNR LMN456). The staff claimed my baggage was overweight by 5kg but their scale seemed faulty. I had weighed it at home - it was exactly 23kg. They forced me to pay Rs 2000 extra which I believe is wrong. Please investigate."
        },
        {
            subject: "Denied Boarding Despite Valid Ticket - PNR: ABC123",
            body: "This is outrageous! I had a confirmed ticket for 6E-501 DEL to BOM (PNR ABC123, John Doe) but was denied boarding because the flight was 'overbooked'. No one informed me in advance. I was left stranded at the airport with no assistance. I demand explanation and full compensation."
        },
        {
            subject: "Lost Wheelchair at Airport - Urgent (PNR: XYZ789)",
            body: "My elderly mother (Jane Smith, PNR XYZ789) required a wheelchair for flight 6E-202 from Bangalore. We requested it during booking but no wheelchair was provided at BLR airport. She had to walk with great difficulty. This is discrimination against differently-abled passengers. We need immediate action and apology."
        }
    ];

    for (const c of testComplaints) {
        console.log(`Injecting Complaint: ${c.subject}`);
        await outlook.createMessageInFolder(targetEmail, complaintsFolderId, c.subject, c.body);
    }

    console.log('Test emails injected.');
}

seedAndTest().catch(console.error).finally(() => prisma.$disconnect());
