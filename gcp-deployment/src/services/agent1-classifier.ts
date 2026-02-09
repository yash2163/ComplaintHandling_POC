import { VertexAI, HarmBlockThreshold, HarmCategory } from '@google-cloud/vertexai';
import { FirestoreService } from '../services/firestore';

interface EmailInput {
    subject: string;
    body: string;
    receivedAt: Date;
}

interface InvestigationGrid {
    passenger_name: string | null;
    pnr: string | null;
    flight_number: string | null;
    flight_date: string | null;
    route: string | null;
    issue_category: string | null;
    issue_summary: string | null;
    requested_resolution: string | null;
    urgency_level: 'low' | 'medium' | 'high' | null;
    origin_station: string | null;
}

export class Agent1ComplaintClassifier {
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
                temperature: 0.1,
                maxOutputTokens: 8192,
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
     * Agent 1: Extract investigation grid from complaint email
     */
    async extractInvestigationGrid(email: EmailInput): Promise<{
        grid: InvestigationGrid;
        confidence: number;
    }> {
        const startTime = Date.now();

        const prompt = `You are Agent 1 - Complaint Investigation Grid Extractor for an airline customer service system.

Your task is to analyze the incoming complaint email and extract structured information into an investigation grid.

**Email Details:**
- Subject: ${email.subject}
- Received At: ${email.receivedAt.toISOString()}
- Body:
${email.body}

**Instructions:**
1. Extract the following fields from the email. If a field cannot be determined, set it to null.
2. Use your knowledge of airline operations to infer missing information where reasonable.
3. Categorize the issue based on common airline complaint types.
4. Assess urgency:
   - 'high': Safety issues, medical emergencies, immediate financial impact
   - 'medium': Service failures, delayed baggage, missed connections
   - 'low': Minor inconveniences, feedback, suggestions

**Required Output Format (JSON):**
{
  "grid": {
    "passenger_name": string | null,
    "pnr": string | null,
    "flight_number": string | null,
    "flight_date": string | null,  // Format: YYYY-MM-DD
    "route": string | null,  // Format: "XXX-YYY"
    "issue_category": string | null,  // e.g., "Baggage Delay", "Flight Delay", "Service Quality"
    "issue_summary": string | null,  // Brief 1-2 sentence summary
    "requested_resolution": string | null,
    "urgency_level": "low" | "medium" | "high" | null,
    "origin_station": string | null  // 3-letter IATA code
  },
  "confidence": number  // 0.0 to 1.0
}

Respond ONLY with valid JSON matching this structure.`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response.text();
            const parsed = JSON.parse(response);

            const executionTime = Date.now() - startTime;

            // Log activity to Firestore
            await this.firestoreService.logAgentActivity({
                agentName: 'Agent 1',
                agentAction: 'extract_investigation_grid',
                input: {
                    emailId: email.subject, // Will be replaced with actual email ID in worker
                    subject: email.subject,
                    bodyPreview: email.body.substring(0, 200)
                },
                output: {
                    success: true,
                    data: parsed
                },
                executionTimeMs: executionTime,
                modelUsed: 'gemini-2.0-flash-exp',
                displayMessage: `Agent 1 extracted investigation grid for complaint`
            });

            return parsed;
        } catch (error) {
            const executionTime = Date.now() - startTime;

            // Log error
            await this.firestoreService.logAgentActivity({
                agentName: 'Agent 1',
                agentAction: 'extract_investigation_grid',
                input: {
                    emailId: email.subject,
                    subject: email.subject,
                    bodyPreview: email.body.substring(0, 200)
                },
                output: {
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                },
                executionTimeMs: executionTime,
                modelUsed: 'gemini-2.0-flash-exp',
                displayMessage: `Agent 1 failed to extract grid: ${error instanceof Error ? error.message : String(error)}`
            });

            throw error;
        }
    }

    /**
     * Agent 1: Classify if email is an airline complaint
     */
    async isAirlineComplaint(subject: string, body: string): Promise<boolean> {
        const startTime = Date.now();

        const prompt = `You are an email classifier for an airline customer service system.

Determine if the following email is an airline complaint that requires investigation.

**Email:**
- Subject: ${subject}
- Body:
${body.substring(0, 1000)}

**Classification Criteria:**
- TRUE: Complaints about flights, baggage, service, delays, cancellations, refunds, etc.
- FALSE: Marketing emails, newsletters, spam, unrelated inquiries, confirmations, receipts

**Output Format (JSON):**
{
  "is_complaint": boolean,
  "reasoning": string
}

Respond ONLY with valid JSON.`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response.text();
            const parsed = JSON.parse(response);

            const executionTime = Date.now() - startTime;

            await this.firestoreService.logAgentActivity({
                agentName: 'Agent 1',
                agentAction: 'classify_email',
                input: {
                    emailId: subject,
                    subject: subject,
                    bodyPreview: body.substring(0, 200)
                },
                output: {
                    success: true,
                    data: parsed
                },
                executionTimeMs: executionTime,
                modelUsed: 'gemini-2.0-flash-exp',
                displayMessage: `Agent 1 classified email as ${parsed.is_complaint ? 'complaint' : 'not a complaint'}`
            });

            return parsed.is_complaint;
        } catch (error) {
            console.error('Error classifying email:', error);
            // Default to true to avoid missing complaints
            return true;
        }
    }
}
