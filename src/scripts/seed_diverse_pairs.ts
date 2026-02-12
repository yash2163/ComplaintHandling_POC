import prisma from '../services/db';
import { OutlookService } from '../services/outlook';
import { AgentService } from '../services/agent';
import dotenv from 'dotenv';

dotenv.config();

async function seedDiverseComplaintsAndResolutions() {
    const outlook = new OutlookService();
    const agent = new AgentService();
    await outlook.authenticate();
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL!;

    const complaintsFolderId = await outlook.getFolderId(targetEmail, 'Complaints');
    const resolutionsFolderId = await outlook.getFolderId(targetEmail, 'Resolutions');

    if (!complaintsFolderId || !resolutionsFolderId) {
        throw new Error('Outlook folders not found');
    }

    // Step 1: Inject 5 diverse new complaints
    const complaints = [
        {
            subject: "Flight Delay - Missed International Connection (PNR: DEF456)",
            body: "Dear Indigo, My flight 6E-789 from Mumbai to Delhi was delayed by 3 hours on Feb 11th. Due to this delay, I missed my connecting international flight to London. I had to book a new ticket costing INR 85,000. I am requesting compensation for the delay and reimbursement for the additional ticket cost. PNR: DEF456, Passenger: Priya Sharma, Seat: 18B."
        },
        {
            subject: "Rude In-flight Staff - Poor Service (PNR: GHI789)",
            body: "Hello, I am writing to complain about extremely rude behavior from your cabin crew on flight 6E-456 from Bangalore to Kolkata on Feb 10th. When I requested water, the flight attendant rolled her eyes and ignored me for 15 minutes. This is unacceptable service. PNR: GHI789, Passenger: Rajesh Kumar, Seat: 22C, Flight Date: Feb 10th."
        },
        {
            subject: "Special Meal Not Provided Despite Confirmation (PNR: JKL012)",
            body: "Dear Sir/Madam, I pre-booked a diabetic meal for my flight 6E-321 from Chennai to Hyderabad on Feb 11th. Despite receiving confirmation, I was told no special meal was available. I had to go without food during the flight as I cannot consume regular meals. PNR: JKL012, Passenger: Sanjay Patel, Seat: 9A."
        },
        {
            subject: "Incorrect Seat Assignment - Charged Extra (PNR: MNO345)",
            body: "Hi Indigo Team, I booked seat 12A (window) online and paid the extra fee (Rs 600). However, at check-in, I was given seat 28C (middle seat) without any explanation or refund. When I asked, the staff said the system auto-reassigned me. I paid for a specific seat and did not receive it. PNR: MNO345, Passenger: Neha Verma, Flight: 6E-654, Date: Feb 11th."
        },
        {
            subject: "Booking Error - Double Charged for Same Ticket (PNR: PQR678)",
            body: "Dear Customer Service, I booked a ticket for flight 6E-888 from Pune to Goa on Feb 12th. My payment failed initially, so I tried again. However, I was charged TWICE (INR 5,400 each = INR 10,800 total) but only received ONE ticket. I need an immediate refund for the duplicate charge. PNR: PQR678, Passenger: Amit Shah, Booking Date: Feb 9th."
        }
    ];

    console.log('📧 Injecting 5 new complaints...');
    for (let i = 0; i < complaints.length; i++) {
        await outlook.createMessageInFolder(targetEmail, complaintsFolderId, complaints[i].subject, complaints[i].body);
        console.log(`✓ Complaint ${i + 1}/5: ${complaints[i].subject}`);
    }

    // Step 2: Wait for worker to process complaints
    console.log('\n⏳ Waiting 30 seconds for worker to process complaints...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Step 3: Find processed complaints
    const processedComplaints = await prisma.complaint.findMany({
        where: {
            status: 'WAITING_OPS',
            subject: {
                in: complaints.map(c => c.subject)
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    if (processedComplaints.length === 0) {
        console.log('⚠️ No complaints processed yet. Re-run this script in 30 seconds.');
        return;
    }

    console.log(`\n✅ Found ${processedComplaints.length} processed complaints. Injecting HTML resolution emails...\n`);

    // Step 4: Inject HTML-formatted resolution emails with mixed quality
    const resolutionTemplates = [
        {
            // Flight delay - EXCELLENT resolution (80%+)
            action: 'Verified flight logs. Flight 6E-789 was delayed due to technical issue with landing gear. Delay was communicated to passengers. Reviewed missed connection claim with valid proof of international ticket.',
            outcome: 'Full compensation of INR 10,000 issued per DGCA guidelines for 3-hour delay. Additional reimbursement of INR 85,000 for missed international connection processed. Total refund: INR 95,000. Amount will reflect in 5-7 business days.',
            quality: 'excellent'
        },
        {
            // Rude staff - POOR resolution (<60%)
            action: 'Reviewed crew roster. Flight attendant claims passenger was demanding and unreasonable. No CCTV evidence available as cameras do not cover all sections.',
            outcome: 'Unable to substantiate claim without concrete evidence. Issued 500 bonus miles as goodwill gesture. Reminded crew about professional conduct.',
            quality: 'poor'
        },
        {
            // Special meal - AVERAGE resolution (60-79%)
            action: 'Checked pre-order system. Diabetic meal was confirmed but catering vendor failed to load it onto aircraft. Vendor has been penalized.',
            outcome: 'Issued apology letter and refunded meal pre-booking fee of Rs 250. Provided 1500 bonus miles for inconvenience. Implemented measures to prevent recurrence.',
            quality: 'average'
        },
        {
            // Seat assignment - EXCELLENT resolution (80%+)
            action: 'Verified booking records and payment logs. Seat 12A payment (Rs 600) confirmed. System error during check-in auto-downgraded passenger to free seat. Error has been logged and reported to IT team.',
            outcome: 'Full refund of Rs 600 seat selection fee processed immediately. Additional compensation of Rs 1000 issued for inconvenience. Total refund: Rs 1600. Also credited 2000 bonus miles to customer account.',
            quality: 'excellent'
        },
        {
            // Double charge - AVERAGE resolution (60-79%)
            action: 'Reviewed payment gateway logs. First transaction showed as failed on our end but was debited from bank. Second payment went through successfully, creating duplicate charge.',
            outcome: 'Refund of INR 5,400 (duplicate charge) initiated. However, refund timeline is 10-15 business days due to bank processing. No additional compensation provided as this was a technical glitch.',
            quality: 'average'
        }
    ];

    for (let i = 0; i < processedComplaints.length && i < resolutionTemplates.length; i++) {
        const complaint = processedComplaints[i];
        const resolution = resolutionTemplates[i];
        const grid = complaint.investigationGrid as any;

        // Create updated grid with resolution
        const updatedGrid = {
            pnr: grid?.pnr || '-',
            customer_name: grid?.customer_name || '-',
            flight_number: grid?.flight_number || '-',
            seat_number: grid?.seat_number || '-',
            source: grid?.source || '-',
            destination: grid?.destination || '-',
            complaint: grid?.complaint || '-',
            issue_type: grid?.issue_type || '-',
            weather_condition: grid?.weather_condition || '-',
            date: grid?.date || '-',
            action_taken: resolution.action,
            outcome: resolution.outcome,
            agent_summary: null,
            confidence_score: null,
            agent_reasoning: null
        };

        // Generate HTML table
        const gridHtml = agent.formatGridAsHtmlTable(updatedGrid as any);

        const resolutionBody = `
<p>Dear CR Team,</p>
<p>We have completed the investigation for <strong>PNR ${updatedGrid.pnr}</strong>.</p>

<hr style="border: 1px dashed #ccc; margin: 20px 0;">

${gridHtml}

<hr style="border: 1px dashed #ccc; margin: 20px 0;">

<p><strong>Quality:</strong> ${resolution.quality.toUpperCase()}</p>
<p><em>Please review the resolution details in the grid above.</em></p>

<p>Regards,<br/>
<strong>Base Ops Team</strong></p>
        `;

        await outlook.createMessageInFolder(
            targetEmail,
            resolutionsFolderId,
            `Re: [ACTION REQUIRED] Investigation Request: ${complaint.subject} [Case: ${complaint.id}]`,
            resolutionBody
        );

        console.log(`✓ Resolution ${i + 1}/5 injected (${resolution.quality.toUpperCase()}): Case ${complaint.id.substring(0, 8)}`);
    }

    console.log(`\n🎉 Successfully injected ${processedComplaints.length} complaint-resolution pairs!`);
    console.log('\n📊 Quality Distribution:');
    console.log('   - EXCELLENT (80%+): 2 resolutions');
    console.log('   - AVERAGE (60-79%): 2 resolutions');
    console.log('   - POOR (<60%): 1 resolution');
    console.log('\n⏳ Wait ~30 seconds for Agent 2 to process and evaluate the resolutions.');
}

seedDiverseComplaintsAndResolutions()
    .catch(console.error)
    .finally(() => process.exit(0));
