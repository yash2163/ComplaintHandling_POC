import { AgentService } from '../services/agent';
import { NormalizedEmail, EmailType } from '../types/domain';

async function testAgent() {
    const agent = new AgentService();

    const dummyEmail: NormalizedEmail = {
        id: 'test-123',
        sourceId: 'test-123',
        subject: 'Complaint regarding Flight AI101 Delay',
        sender: { email: 'customer@example.com', name: 'John Doe' },
        recipients: [],
        body: 'My flight AI101 on 2024-01-10 was delayed by 5 hours because of bad weather.',
        receivedAt: new Date(),
        hasAttachments: false,
        classification: EmailType.CX_COMPLAINT
    };

    console.log('Testing Agent Extraction...');
    console.log('Input Email:', dummyEmail.body);

    const result = await agent.extractInvestigationGrid(dummyEmail);

    console.log('Extraction Result:');
    console.log(JSON.stringify(result, null, 2));
}

testAgent();
