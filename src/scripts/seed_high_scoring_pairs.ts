import prisma from '../services/db';
import { OutlookService } from '../services/outlook';
import dotenv from 'dotenv';

dotenv.config();

async function seedHighScoringPairs() {
    const outlook = new OutlookService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL!;

    const complaintsFolderId = await outlook.getFolderId(targetEmail, 'Complaints');
    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');

    if (!complaintsFolderId || !resolutionsFolderId) {
        throw new Error('Outlook folders not found');
    }

    // Complaint 1: Simple baggage delay - will score 60-80 (YELLOW - partial resolution)
    const complaint1 = {
        subject: "Delayed Baggage Delivery - PNR: ABC123",
        body: "Dear Indigo, My checked baggage for flight 6E-501 from Delhi to Mumbai (PNR: ABC123, passenger John Doe) did not arrive with me. It's been 6 hours since landing and I still don't have my bag. I have important medications inside. Please locate and deliver urgently. Seat 12A."
    };

    // Complaint 2: Refund request with valid medical emergency - will score 80+ (GREEN - excellent resolution)
    const complaint2 = {
        subject: "Medical Emergency Refund Request - PNR: XYZ789",
        body: "To whom it may concern, I am requesting a full refund for my flight 6E-202 from Bangalore to Delhi scheduled for Feb 10th (PNR: XYZ789, passenger Jane Smith, seat 15C). My mother was admitted to ICU with a heart attack yesterday evening. I have attached the hospital admission letter and doctor's certificate. This is a genuine emergency and I would greatly appreciate a prompt refund so I can rebook for an earlier flight. Thank you for your understanding."
    };

    console.log('Injecting 2 new complaints...');

    await outlook.createMessageInFolder(targetEmail, complaintsFolderId, complaint1.subject, complaint1.body);
    console.log('✓ Complaint 1 injected: Delayed Baggage');

    await outlook.createMessageInFolder(targetEmail, complaintsFolderId, complaint2.subject, complaint2.body);
    console.log('✓ Complaint 2 injected: Medical Emergency Refund');

    // Wait for worker to process these complaints (Agent 1)
    console.log('\nWaiting 20 seconds for worker to process complaints...');
    await new Promise(resolve => setTimeout(resolve, 20000));

    // Find these specific complaints in database
    const baggageComplaint = await prisma.complaint.findFirst({
        where: {
            subject: { contains: 'Delayed Baggage Delivery' },
            status: 'WAITING_OPS'
        }
    });

    const medicalComplaint = await prisma.complaint.findFirst({
        where: {
            subject: { contains: 'Medical Emergency Refund Request' },
            status: 'WAITING_OPS'
        }
    });

    if (!baggageComplaint || !medicalComplaint) {
        console.log('Complaints not yet processed by worker. Please run this script again in 30 seconds.');
        return;
    }

    console.log('\nFound both complaints in database. Injecting resolutions...');

    // Resolution 1: Partial resolution for baggage delay (should score 60-80 - YELLOW)
    const baggageGrid = baggageComplaint.investigationGrid as any;
    const resolution1GridText = `=== INVESTIGATION GRID ===
PNR: ${baggageGrid.pnr || '-'}
Customer Name: ${baggageGrid.customer_name || '-'}
Flight Number: ${baggageGrid.flight_number || '-'}
Seat Number: ${baggageGrid.seat_number || '-'}
Source: ${baggageGrid.source || '-'}
Destination: ${baggageGrid.destination || '-'}
Complaint: ${baggageGrid.complaint || '-'}
Issue Type: ${baggageGrid.issue_type || '-'}
Weather Condition: ${baggageGrid.weather_condition || '-'}
Date: ${baggageGrid.date || '-'}
---
Action Taken: Located the baggage at Delhi airport baggage handling area. Bag was misrouted to alternate carousel due to system error during sorting.
Outcome: Baggage delivered to passenger's hotel address within 12 hours of landing. Rs 1000 compensation voucher issued for inconvenience.
=== END GRID ===`;

    const resolution1Body = `
Dear CR Team,

We have completed the investigation for PNR ${baggageGrid.pnr}.

${resolution1GridText}

Additional Comments: Baggage arrived at passenger hotel at 9:30 PM same day. Passenger was satisfied with delivery but mentioned medications concern. System error has been reported to IT team.

Regards,
Base Ops Team
    `;

    // Resolution 2: Excellent resolution for medical emergency (should score 80+ - GREEN)
    const medicalGrid = medicalComplaint.investigationGrid as any;
    const resolution2GridText = `=== INVESTIGATION GRID ===
PNR: ${medicalGrid.pnr || '-'}
Customer Name: ${medicalGrid.customer_name || '-'}
Flight Number: ${medicalGrid.flight_number || '-'}
Seat Number: ${medicalGrid.seat_number || '-'}
Source: ${medicalGrid.source || '-'}
Destination: ${medicalGrid.destination || '-'}
Complaint: ${medicalGrid.complaint || '-'}
Issue Type: ${medicalGrid.issue_type || '-'}
Weather Condition: ${medicalGrid.weather_condition || '-'}
Date: ${medicalGrid.date || '-'}
---
Action Taken: Reviewed the hospital admission letter and doctor's certificate. Documents verified as genuine from Apollo Hospital, Bangalore. Medical emergency confirmed as valid reason for cancellation as per airline policy.
Outcome: Full refund of INR 12,500 processed immediately to original payment method. Additionally, waived all cancellation charges. Refund will reflect within 24-48 hours. Passenger also offered priority rebooking assistance for alternate travel dates at no extra cost.
=== END GRID ===`;

    const resolution2Body = `
Dear CR Team,

We have completed the investigation for PNR ${medicalGrid.pnr}.

${resolution2GridText}

Additional Comments: This is a genuine medical emergency involving immediate family. We have expedited the refund process and the passenger was very grateful for our swift response. Our thoughts are with the family during this difficult time.

Regards,
Base Ops Team
    `;

    await outlook.createMessageInFolder(
        targetEmail,
        resolutionsFolderId,
        `Re: [ACTION REQUIRED] Investigation Request: ${baggageComplaint.subject} - PNR: ${baggageGrid.pnr} [Case: ${baggageComplaint.id}]`,
        resolution1Body
    );
    console.log('✓ Resolution 1 injected: Baggage delivered (expect 60-80 score - YELLOW)');

    await outlook.createMessageInFolder(
        targetEmail,
        resolutionsFolderId,
        `Re: [ACTION REQUIRED] Investigation Request: ${medicalComplaint.subject} - PNR: ${medicalGrid.pnr} [Case: ${medicalComplaint.id}]`,
        resolution2Body
    );
    console.log('✓ Resolution 2 injected: Medical emergency handled (expect 80+ score - GREEN)');

    console.log('\n✅ Successfully injected 2 high-scoring complaint-resolution pairs!');
    console.log('Wait ~30 seconds for Agent 2 to process and evaluate these resolutions.');
}

seedHighScoringPairs()
    .catch(console.error)
    .finally(() => process.exit(0));
