import { AgentService } from '../services/agent';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function testParsing() {
    const agent = new AgentService();

    // Read the debug file content
    const debugFilePath = path.join(process.cwd(), 'resolution_debug.txt');
    if (!fs.existsSync(debugFilePath)) {
        console.error('Debug file resolution_debug.txt not found. Run debug_resolution_email.ts first.');
        return;
    }

    const emailBody = fs.readFileSync(debugFilePath, 'utf-8');
    console.log('--- Testing Parsing on Email Body (Length: ' + emailBody.length + ') ---');

    console.log('Calling agent.parseResolutionFromEmail()...');
    const result = await agent.parseResolutionFromEmail(emailBody);

    console.log('\n--- RESULT ---');
    console.log(JSON.stringify(result, null, 2));

    if (result && result.action_taken && result.outcome) {
        console.log('\n✅ SUCCESS: Extracted Action Taken and Outcome via LLM/Regex.');
    } else {
        console.log('\n❌ FAILED: Could not extract required fields.');
    }
}

testParsing().catch(console.error);
