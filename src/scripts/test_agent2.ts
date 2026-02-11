import { AgentService } from '../services/agent';
import dotenv from 'dotenv';
dotenv.config();

async function testAgent2() {
    const agent = new AgentService();

    const complaint = {
        subject: "Damaged Luggage Claim - Urgent",
        body: "My bag handle is completely broken! I need compensation."
    };

    const crewResponse = {
        subject: "[Case: test] Re: Investigation for 6E-999 - Damaged Luggage",
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

    console.log('Testing Agent 2 with resolution email...\n');

    const result = await agent.evaluateResolution(complaint, crewResponse);

    console.log('Agent 2 Response:');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n--- Field Check ---');
    console.log('action_taken:', result.action_taken || 'MISSING');
    console.log('outcome:', result.outcome || 'MISSING');
}

testAgent2().catch(console.error);
