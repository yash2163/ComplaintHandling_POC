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

    public async extractInvestigationGrid(email: NormalizedEmail): Promise<{ grid: InvestigationGrid, confidence: any }> {
        const prompt = `
      You are a specialized data extraction agent for an airline CX team.
      Your goal is to extract specific facts from the email below into a structured JSON grid.
      
      RULES:
      1. Extract ONLY explicitly stated facts. Do not guess or infer.
      2. If a field is not explicitly mentioned, return null.
      3. For 'issue_type', categorize into: 'Delay', 'Cancellation', 'StaffBehavior', 'Baggage', 'Refund', 'Other'.
      4. For 'weather_condition', only extract if the user explicitly mentions weather causing the issue.

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
          "weather_condition": "string or null"
        },
        "field_confidence": {
          "flight_number": "EXPLICIT | INFERRED | MISSING",
          "date": "EXPLICIT | INFERRED | MISSING",
          "issue_type": "EXPLICIT | INFERRED | MISSING",
          "weather_condition": "EXPLICIT | INFERRED | MISSING"
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
                grid: { flight_number: null, date: null, issue_type: null, weather_condition: null },
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
}
