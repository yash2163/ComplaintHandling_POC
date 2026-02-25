import { RAGAgent } from './agent_api/llm_rag';

async function testRAG() {
    console.log("Starting RAG test...");
    const agent = new RAGAgent();

    const mockComplaint = "My flight 6E-101 was delayed by 4 hours and I missed my connection. I want a refund.";
    const mockPNR = {
        customerName: "Jane Doe",
        flightNumber: "6E-101",
        source: "DEL",
        destination: "BOM"
    };

    try {
        const result = await agent.processComplaintRAG(mockComplaint, mockPNR);
        console.log("\n=================== RAG RETRIEVED CONTEXT ===================");
        console.log(result.retrieved_context);
        console.log("=============================================================\n");

        console.log("RAG Final Decision:", JSON.stringify({
            category: result.category,
            suggested_action: result.suggested_action,
            suggested_outcome: result.suggested_outcome,
            is_auto_resolve_eligible: result.is_auto_resolve_eligible,
            reasoning: result.reasoning
        }, null, 2));
    } catch (e) {
        console.error("RAG Test Failed:", e);
    }
}

testRAG();
