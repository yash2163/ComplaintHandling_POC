import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import dotenv from 'dotenv';
import { NormalizedEmail, InvestigationGrid } from '../types/domain';

dotenv.config();

export class AgentService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY not found');
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });
  }

  public async extractInvestigationGrid(email: { body: string, subject: string, receivedAt: Date }): Promise<{ grid: InvestigationGrid & { origin_station: string | null }, confidence: any }> {
    const prompt = `
      You are a specialized data extraction agent for an airline CX team.
      Your goal is to extract specific facts from the email below into a structured JSON grid.
      
      RULES:
      1. Extract ONLY explicitly stated facts. Do not guess or infer.
      2. If a field is not explicitly mentioned, return null.
      3. For 'issue_type', categorize into: 'Delay', 'Cancellation', 'StaffBehavior', 'Baggage', 'Refund', 'Other'.
      4. For 'weather_condition', only extract if the user explicitly mentions weather causing the issue.
      5. Extract 'origin_station' as the 3-letter IATA code (e.g., DEL, BOM, BLR) if mentioned. If city name mentioned, map to code. If not found, null.

      EMAIL CONTENT:
      Subject: ${email.subject}
      Body: ${email.body}
      Received At: ${email.receivedAt}

      OUTPUT SCHEMA (JSON):
      {
        "grid": {
          "pnr": "string or null (Look for 6-character alphanumeric PNR)",
          "complaint": "string or null (Brief summary of the passenger's complaint)",
          "flight_number": "string or null",
          "date": "YYYY-MM-DD or null",
          "issue_type": "string or null",
          "weather_condition": "string or null",
          "origin_station": "string or null"
        },
        "field_confidence": {
          "pnr": "EXPLICIT | INFERRED | MISSING",
          "complaint": "EXPLICIT | INFERRED | MISSING",
          "flight_number": "...",
          "date": "...",
          "issue_type": "...",
          "weather_condition": "...",
          "origin_station": "..."
        }
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Agent extraction failed:', error);
      // Fallback empty grid
      return {
        grid: {
          pnr: null,
          complaint: null,
          flight_number: null,
          date: null,
          issue_type: null,
          weather_condition: null,
          origin_station: null,
          customer_name: null,
          seat_number: null,
          source: null,
          destination: null
        },
        confidence: {}
      };
    }
  }

  public async updateGridWithBaseOps(currentGrid: InvestigationGrid, baseOpsEmail: NormalizedEmail): Promise<{ grid: InvestigationGrid, cx_summary: string }> {
    const prompt = `
        You are Agent 2. Your job is to update an investigation grid based on a response from Base Operations.
        
        CURRENT GRID:
        ${JSON.stringify(currentGrid, null, 2)}
        
        BASE OPS EMAIL BODY:
        ${baseOpsEmail.body}
        
        RULES:
        1. Only update fields that Base Ops explicitly provides new info for.
        2. Leave other fields UNCHANGED.
        3. Do not infer unless Base Ops explicitly states it.
        4. Provide a "cx_summary": a 1-sentence explanation for the CX agent.
        
        OUTPUT SCHEMA (JSON):
        {
          "grid": { ...same schema as input... },
          "cx_summary": "string"
        }
      `;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Agent 2 failed:', error);
      return { grid: currentGrid, cx_summary: "Error processing update." };
    }
  }

  public async generateDraftResponse(complaintGrid: any, crewNotes: string): Promise<string> {
    const prompt = `
      You are a polite and professional airline customer service agent (Agent 2).
      Your goal is to write a reply to a customer complaint based on the investigation findings.
      
      COMPLAINT DETAILS:
      ${JSON.stringify(complaintGrid, null, 2)}
      
      FLIGHT CREW/OPS NOTES:
      "${crewNotes}"
      
      RULES:
      1. Be empathetic but professional.
      2. Use the "issue_type" and "crewNotes" to explain the situation transparently.
      3. If the crew notes admit a fault, apologize sincerely.
      4. If the crew notes deny the claim (e.g. weather was bad), explain it clearly using the data.
      5. Keep it concise (under 200 words).
      6. Return ONLY the plain text of the email body.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('Agent 2 draft generation failed:', error);
      return "We are reviewing your complaint and will get back to you shortly.";
    }
  }
  public async evaluateResolution(complaint: { subject: string, body: string }, crewResponse: { subject: string, body: string }): Promise<{ status: 'RESOLVED' | 'FLAGGED', reasoning: string, summary: string, draft_response: string }> {
    const prompt = `
      You are Agent 2, a supervisor AI for an airline. 
      Your goal is to evaluate if the Flight Crew's response ADEQUATELY resolves the Customer's complaint.

      CUSTOMER COMPLAINT:
      Subject: ${complaint.subject}
      Body: ${complaint.body}

      FLIGHT CREW RESPONSE:
      Subject: ${crewResponse.subject}
      Body: ${crewResponse.body}

      RULES:
      1. Compare the complaint's specific grievances vs. the crew's actions.
      2. If crew addresses the core issue (e.g. found bag, processed refund, explained delay validly), mark as "RESOLVED".
      3. If crew is dismissive, misses the point, or doesn't offer a required apology/compensation, mark as "FLAGGED".
      4. "reasoning": Internal note explaining your decision.
      5. "summary": A 1-sentence summary of what the crew did (e.g. "Crew located bag and arranged delivery.").
      6. "draft_response": A polite email reply to the CUSTOMER from "Base Ops Team", incorporating the resolution details.

      OUTPUT SCHEMA (JSON):
      {
        "status": "RESOLVED" | "FLAGGED",
        "reasoning": "string",
        "summary": "string",
        "draft_response": "string"
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      // Simple cleanup if markdown blocks are returned
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '');
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Agent 2 evaluation failed:', error);
      return {
        status: 'FLAGGED',
        reasoning: 'Agent 2 failed to process resolution. Manual review required.',
        summary: 'Error in AI evaluation.',
        draft_response: ''
      };
    }
  }

  public async isAirlineComplaint(subject: string, body: string): Promise<boolean> {
    const prompt = `
        You are an email classifier for an airline Customer Experience team.
        Determine if the following email is a legitimate customer complaint or inquiry regarding an airline service (flight, baggage, refund, staff, etc.).

        EMAIL SUBJECT: ${subject}
        EMAIL BODY: ${body}

        RULES:
        1. Return ONLY the word "TRUE" if it is an airline complaint/inquiry.
        2. Return ONLY the word "FALSE" if it is spam, marketing, completely unrelated (e.g. personal talk, job application, B2B sales), or a system notification not related to a specific passenger issue.
        3. Be lenient with vague complaints, but strict with spam.
        `;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text().trim().toUpperCase();
      return responseText.includes("TRUE");
    } catch (error) {
      console.error('Classification failed:', error);
      // Fail safe: accept it if classification fails, or reject? 
      // Better to accept and let manual review handle it than drop a real complaint.
      return true;
    }
  }
}
