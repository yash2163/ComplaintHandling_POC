import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import { VectorStore } from './vector_store';
import { checkPermissionLimit, getResolutionsDb } from './database';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const llm = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Using standard flash for text gen

const vectorStore = new VectorStore();

export interface RAGDecisionResult {
    category: string;
    suggested_action: string;
    suggested_outcome: string;
    draft_response: string;
    is_auto_resolve_eligible: boolean;
    reasoning: string;
    retrieved_context: string;
}

export class RAGAgent {

    /**
     * Extracts a standard category from the user's complaint
     */
    async extractCategory(complaint: string): Promise<string> {
        const prompt = `Analyze the following airline complaint and assign it to ONE of the following categories: ["Delay", "Baggage", "Staff", "Flight Cancellation", "Refund Request", "Other"].
Complaint: "${complaint}"
Output ONLY the category name.`;

        const response = await llm.generateContent(prompt);
        return response.response.text().trim();
    }

    /**
     * Main RAG logic: Retrieves past similar cases and uses Gemini to decide next actions and draft a response.
     */
    async processComplaintRAG(complaintText: string, pnrDetails: any): Promise<RAGDecisionResult> {
        // 1. Get Category
        const category = await this.extractCategory(complaintText);
        console.log(`[RAG] Classified as: ${category}`);

        // 2. Retrieve top 3 similar past complaints from Vector Store
        let similarCasesText = "";
        try {
            const results = await vectorStore.searchSimilarComplaints(complaintText, category, 3);

            if (results.ids[0] && results.ids[0].length > 0) {
                const db = getResolutionsDb();
                similarCasesText = "Here are similar past cases and how they were resolved:\n";

                for (let i = 0; i < results.ids[0].length; i++) {
                    const complaintId = results.ids[0][i];
                    const stmt = db.prepare('SELECT action_taken, outcome, quality_flag FROM resolutions WHERE complaint_id = ?');
                    const row = stmt.get(complaintId) as any;

                    if (row) {
                        similarCasesText += `- Past Case: "${results.documents[0] ? results.documents[0][i] : ''}"\n`;
                        similarCasesText += `  Action Taken: ${row.action_taken}\n`;
                        similarCasesText += `  Outcome: ${row.outcome}\n`;
                        similarCasesText += `  Quality of Resolution: ${row.quality_flag}\n\n`;
                    }
                }
                db.close();
            } else {
                similarCasesText = "No similar past cases found.";
            }
        } catch (error) {
            console.error("[RAG] Vector Search encountered an error (Chroma may not be running). Proceeding without similarity context.");
            similarCasesText = "Context unavailable.";
        }

        // 3. Construct the RAG Prompt
        const pnrInfo = pnrDetails
            ? `Customer: ${pnrDetails.customerName}, Flight: ${pnrDetails.flightNumber}, Route: ${pnrDetails.source}->${pnrDetails.destination}`
            : `Passenger Details NOT FOUND for this complaint.`;

        const systemPrompt = `You are an AI Airline Customer Service Agent making resolution decisions based on local policies and past case history.
Given a new complaint, passenger details, and a set of similar past cases (some resolved well 'Good', some resolved poorly 'Bad'), you must decide the optimal action to take for the customer.

IMPORTANT RULES:
1. Pay close attention to the 'Quality of Resolution' in past cases. Mimic 'Good' resolutions, and AVOID 'Bad' resolutions.
2. Formulate a specific 'Action' (e.g., "Refund", "Voucher", "Apology") and a specific 'Outcome' (e.g., "30% refund", "Provide a $50 voucher").
3. Determine if you can mathematically extract a percentage from your 'Outcome' if it's a refund or discount (e.g., "20% refund" -> 20).
4. Draft a polite, professional email response to the customer based on your decision.
5. Provide brief reasoning for your choice.

Current Complaint: "${complaintText}"
Passenger Details: ${pnrInfo}
Category: ${category}

${similarCasesText}

Respond ONLY with a valid JSON document using the following schema:
{
  "suggested_action": "e.g., Refund, Voucher, Apology",
  "suggested_outcome": "e.g., 20% refund on ticket value",
  "extracted_percentage": 20, /* Integer percentage if applicable, otherwise 0 */
  "draft_response": "The full text of the email you would send to the customer.",
  "reasoning": "Why you chose this action based on past cases."
}`;

        const response = await llm.generateContent({
            contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });

        const jsonText = response.response.text();
        let decision: any;
        try {
            decision = JSON.parse(jsonText);
        } catch (e) {
            console.error("[RAG] Failed to parse LLM JSON:", jsonText);
            throw new Error("Invalid LLM JSON response");
        }

        // 4. Policy Check (Master Table)
        const actionType = decision.suggested_action.toLowerCase();
        const percentage = decision.extracted_percentage || 0;

        // If the LLM proposes an action, does the agent have permission?
        // Let's assume non-percentage actions (like Apology) have a 100% limit in the master table, or are auto-approved.
        let isEligible = true;

        // Check ONLY if percentage is > 0 OR if it explicitly matches a restricted action word
        if (actionType.includes("refund") || actionType.includes("voucher")) {
            isEligible = checkPermissionLimit(actionType.includes("refund") ? "refund" : "voucher", percentage === 0 ? 100 : percentage);
        }

        return {
            category,
            suggested_action: decision.suggested_action,
            suggested_outcome: decision.suggested_outcome,
            draft_response: decision.draft_response,
            is_auto_resolve_eligible: isEligible,
            reasoning: decision.reasoning,
            retrieved_context: similarCasesText
        };
    }
}
