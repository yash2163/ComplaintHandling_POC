import { AgentService } from '../services/agent';
import { StorageService } from '../services/storage';
import { NormalizedEmail, EmailType, CaseFile } from '../types/domain';
// Uuid removed
// For POC without uuid package:
const uuid = () => Math.random().toString(36).substring(2, 15);

async function demoOrchestration() {
    const agent = new AgentService();
    const storage = new StorageService();
    await storage.init();

    console.log("=== PHASE 2: INGESTION (SIMULATED) ===");
    // 1. Simulate Incoming CX Email
    const cxEmail: NormalizedEmail = {
        id: uuid(),
        sourceId: 'cx-email-001',
        subject: 'Flight AI101 Delay Complaint',
        sender: { email: 'angry.pax@gmail.com', name: 'Angry Pax' },
        recipients: ['helpdesk@indigo.in'],
        body: 'My flight AI101 on 2024-01-10 was delayed. I assume it was weather but nobody told us. I want a refund.',
        receivedAt: new Date(),
        hasAttachments: false,
        classification: EmailType.CX_COMPLAINT
    };
    await storage.saveRawEmail(cxEmail);
    console.log("CX Email Ingested & Classified.");

    console.log("\n=== PHASE 3: AGENT 1 (EXTRACTION) ===");
    // 2. Agent 1 Extracts Grid
    const extraction = await agent.extractInvestigationGrid(cxEmail);
    console.log("Agent 1 Output:", JSON.stringify(extraction, null, 2));

    // 3. create Case
    let caseFile: CaseFile = {
        caseId: uuid(),
        originalEmailId: cxEmail.id,
        rawEmail: cxEmail,
        grid: extraction.grid,
        status: 'WAITING_OPS',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    await storage.saveCase(caseFile);
    console.log(`Case Created: ${caseFile.caseId}. Status: WAITING_OPS`);

    console.log("\n=== PHASE 4: SYSTEM ORCHESTRATION ===");
    // 4. System simulates sending email to Base Ops
    console.log(">> System sending email to Base Ops with Grid...");

    console.log("\n=== PHASE 5: AGENT 2 (BASE OPS RESPONSE) ===");
    // 5. Simulate Base Ops Response
    const baseOpsEmail: NormalizedEmail = {
        id: uuid(),
        sourceId: 'ops-email-001',
        subject: 'RE: Flight AI101 Delay Complaint',
        sender: { email: 'ops@indigo.in', name: 'Base Ops' },
        recipients: ['helpdesk@indigo.in'],
        body: 'Checked logs. AI101 on 2024-01-10 was delayed due to Technical Glitch in hydraulic system, not weather. Delay was 4 hours.',
        receivedAt: new Date(),
        hasAttachments: false,
        classification: EmailType.BASE_OPS_RESPONSE
    };
    console.log(">> Recieved Base Ops Response:", baseOpsEmail.body);

    // 6. Agent 2 Updates Grid
    const updateResult = await agent.updateGridWithBaseOps(caseFile.grid, baseOpsEmail);
    console.log("Agent 2 Output:", JSON.stringify(updateResult, null, 2));

    // 7. Update Case
    caseFile.grid = updateResult.grid;
    caseFile.status = 'READY_FOR_REVIEW';
    caseFile.updatedAt = new Date();
    await storage.saveCase(caseFile);
    console.log(`Case Updated: ${caseFile.caseId}. Status: READY_FOR_REVIEW`);
    console.log("Final Grid:", JSON.stringify(caseFile.grid, null, 2));
    console.log("CX Summary:", updateResult.cx_summary);
}

demoOrchestration();
