import { VertexAI, HarmBlockThreshold, HarmCategory } from '@google-cloud/vertexai';
import { FirestoreService } from '../services/firestore';
import { ComplaintDocument } from '../types/firestore-schema';

interface ResolutionEmail {
    subject: string;
    body: string;
    senderEmail: string;
    senderName: string;
    receivedAt: Date;
}

interface EvaluationResult {
    status: 'RESOLVED' | 'FLAGGED';
    reasoning: string;
    summary: string;
    confidence: number;
    draftResponse?: string;
}

export class Agent2ResolutionEvaluator {
    private vertexAI: VertexAI;
    private model: any;
    private firestoreService: FirestoreService;

    constructor(projectId: string, location: string = 'us-central1') {
        this.vertexAI = new VertexAI({
            project: projectId,
            location: location
        });

        this.model = this.vertexAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096,
                responseMimeType: 'application/json'
            },
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                }
            ]
        });

        this.firestoreService = new FirestoreService(projectId);
    }

    /**
     * Agent 2: Evaluate if a resolution email adequately resolves the complaint
     */
    async evaluateResolution(
        complaint: ComplaintDocument,
        resolutionEmail: ResolutionEmail
    ): Promise<EvaluationResult> {
        const startTime = Date.now();

        const prompt = `You are Agent 2 - Resolution Evaluator for an airline customer service system.

Your task is to evaluate whether a Base Operations (Ops) team response adequately resolves a customer complaint.

**Original Complaint Details:**
- Complaint ID: ${complaint.id}
- Passenger: ${complaint.investigationGrid.passenger_name || 'N/A'}
- PNR: ${complaint.investigationGrid.pnr || 'N/A'}
- Flight: ${complaint.investigationGrid.flight_number || 'N/A'} on ${complaint.investigationGrid.flight_date || 'N/A'}
- Issue Category: ${complaint.investigationGrid.issue_category || 'N/A'}
- Issue Summary: ${complaint.investigationGrid.issue_summary || 'N/A'}
- Requested Resolution: ${complaint.investigationGrid.requested_resolution || 'N/A'}
- Urgency: ${complaint.investigationGrid.urgency_level || 'N/A'}

**Base Ops Resolution Email:**
- From: ${resolutionEmail.senderName} <${resolutionEmail.senderEmail}>
- Subject: ${resolutionEmail.subject}
- Body:
${resolutionEmail.body}

**Evaluation Criteria:**
1. Does the response address the specific issue mentioned in the complaint?
2. Is there a clear resolution or action taken (refund, compensation, explanation, etc.)?
3. Is the tone professional and empathetic?
4. Are there any unresolved issues or follow-up required?

**Status Determination:**
- **RESOLVED**: The response adequately addresses the complaint with a clear resolution
- **FLAGGED**: The response is insufficient, vague, or requires human review

**Required Output Format (JSON):**
{
  "status": "RESOLVED" | "FLAGGED",
  "reasoning": string,  // Detailed explanation of your decision
  "summary": string,  // Brief summary of the resolution
  "confidence": number,  // 0.0 to 1.0
  "draft_response": string | null  // If RESOLVED, generate a draft customer-facing response; if FLAGGED, set to null
}

**Draft Response Guidelines (if RESOLVED):**
- Address the customer by name if available
- Reference the complaint ID (${complaint.id})
- Acknowledge the issue
- Explain the resolution clearly
- Apologize if appropriate
- Thank them for their patience
- Professional and empathetic tone

Respond ONLY with valid JSON matching this structure.`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response.text();
            const parsed = JSON.parse(response);

            const executionTime = Date.now() - startTime;

            // Log activity to Firestore
            await this.firestoreService.logAgentActivity({
                agentName: 'Agent 2',
                agentAction: 'evaluate_resolution',
                complaintId: complaint.id,
                input: {
                    emailId: resolutionEmail.subject,
                    subject: resolutionEmail.subject,
                    bodyPreview: resolutionEmail.body.substring(0, 200)
                },
                output: {
                    success: true,
                    data: parsed
                },
                executionTimeMs: executionTime,
                modelUsed: 'gemini-2.0-flash-exp',
                displayMessage: `Agent 2 evaluated resolution for ${complaint.id}: ${parsed.status}`
            });

            return {
                status: parsed.status,
                reasoning: parsed.reasoning,
                summary: parsed.summary,
                confidence: parsed.confidence,
                draftResponse: parsed.draft_response
            };
        } catch (error) {
            const executionTime = Date.now() - startTime;

            // Log error
            await this.firestoreService.logAgentActivity({
                agentName: 'Agent 2',
                agentAction: 'evaluate_resolution',
                complaintId: complaint.id,
                input: {
                    emailId: resolutionEmail.subject,
                    subject: resolutionEmail.subject,
                    body Preview: resolutionEmail.body.substring(0, 200)
                },
                output: {
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                },
                executionTimeMs: executionTime,
                modelUsed: 'gemini-2.0-flash-exp',
                displayMessage: `Agent 2 failed to evaluate resolution for ${complaint.id}: ${error instanceof Error ? error.message : String(error)}`
            });

            throw error;
        }
    }
}
