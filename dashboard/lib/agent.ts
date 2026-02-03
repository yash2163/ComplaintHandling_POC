
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NormalizedEmail, InvestigationGrid, CaseFile } from './types';
import dotenv from 'dotenv';
// dashboard next.js loads .env automatically, but this file might be imported in contexts where maybe not? 
// Safe to keep.
dotenv.config();

export class AgentService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_API_KEY is not set');
      // throw new Error('GOOGLE_API_KEY is not set'); // Don't crash immediately for POC
    }
    this.genAI = new GoogleGenerativeAI(apiKey || 'dummy');
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' }); // Using 2.0 Flash as preferred
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
          "flight_number": "string or null",
          "date": "YYYY-MM-DD or null",
          "issue_type": "string or null",
          "weather_condition": "string or null",
          "origin_station": "string or null"
        },
        "field_confidence": {
          "flight_number": "EXPLICIT | INFERRED | MISSING",
          "date": "... same enum ...",
          "issue_type": "...",
          "weather_condition": "...",
          "origin_station": "..."
        }
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      // Handle markdown code blocks
      const jsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Agent extraction failed:', error);
      // Fallback empty grid
      return {
        grid: { flight_number: null, date: null, issue_type: null, weather_condition: null, origin_station: null },
        confidence: {}
      };
    }
  }

  public async updateGridWithBaseOps(currentGrid: InvestigationGrid, baseOpsEmail: NormalizedEmail): Promise<{ grid: InvestigationGrid, cx_summary: string }> {
    // (Keeping code for reference, even if simplified workflow uses generateDraftResponse)
    const prompt = `
      You are Agent 2. Your job is to update an investigation grid based on a response from Base Operations.
      
      CURRENT GRID:
      ${JSON.stringify(currentGrid, null, 2)}
      
      BASE OPS EMAIL BODY:
      ${baseOpsEmail.body}
      
      RULES:
      1. Only update fields that Base Ops explicitly provides new info for.
      2. Leave other fields UNCHANGED.
      3. Generate a "cx_summary" that is a polite, professional, ONE-SENTENCE summary of the finding (e.g., "The flight was delayed due to technical maintenance."). Do not admit fault unless explicit.
      
      OUTPUT SCHEMA (JSON):
      {
        "grid": {
          "flight_number": "string or null",
          "date": "YYYY-MM-DD or null",
          "issue_type": "string or null",
          "weather_condition": "string or null"
        },
        "cx_summary": "string"
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      const jsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Agent update failed:', error);
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
      const result = await this.model.generateContent(prompt); // gemini-2.0-flash-exp (or default)
      return result.response.text();
    } catch (error) {
      console.error('Agent 2 draft generation failed:', error);
      return "We are reviewing your complaint and will get back to you shortly.";
    }
  }
}
