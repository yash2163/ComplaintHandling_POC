import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import dotenv from 'dotenv';
import { NormalizedEmail, InvestigationGrid } from '../types/domain';

dotenv.config();

export interface CompleteInvestigationGrid {
  pnr: string | null;
  customer_name: string | null;
  flight_number: string | null;
  seat_number: string | null;
  source: string | null;
  destination: string | null;
  complaint: string | null;
  issue_type: string | null;
  weather_condition: string | null;
  date: string | null;
  action_taken: string | null;
  outcome: string | null;
  agent_summary: string | null;
  confidence_score: number | null;
  agent_reasoning: string | null;
}

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

  /**
   * Format grid as structured text for email
   */
  public formatGridAsStructuredText(grid: CompleteInvestigationGrid): string {
    return `=== INVESTIGATION GRID ===
PNR: ${grid.pnr || '-'}
Customer Name: ${grid.customer_name || '-'}
Flight Number: ${grid.flight_number || '-'}
Seat Number: ${grid.seat_number || '-'}
Source: ${grid.source || '-'}
Destination: ${grid.destination || '-'}
Complaint: ${grid.complaint || '-'}
Issue Type: ${grid.issue_type || '-'}
Weather Condition: ${grid.weather_condition || '-'}
Date: ${grid.date || '-'}
${grid.action_taken || grid.outcome ? '---' : ''}
${grid.action_taken ? `Action Taken: ${grid.action_taken}` : ''}
${grid.outcome ? `Outcome: ${grid.outcome}` : ''}
${grid.agent_summary ? `Agent Summary: ${grid.agent_summary}` : ''}
${grid.confidence_score !== null && grid.confidence_score !== undefined ? `Confidence Score: ${grid.confidence_score}%` : ''}
=== END GRID ===`;
  }

  /**
   * Format grid as HTML table for email
   */
  public formatGridAsHtmlTable(grid: CompleteInvestigationGrid): string {
    const hasResolution = grid.action_taken || grid.outcome;

    return `
<table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; margin: 20px 0;">
  <thead>
    <tr style="background-color: #0052cc; color: white;">
      <th colspan="2" style="padding: 12px; text-align: left; font-size: 16px; border: 1px solid #ddd;">
        📋 INVESTIGATION GRID
      </th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color: #f9f9f9;">
      <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd; width: 180px;">PNR</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${grid.pnr || '-'}</td>
    </tr>
    <tr>
      <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Customer Name</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${grid.customer_name || '-'}</td>
    </tr>
    <tr style="background-color: #f9f9f9;">
      <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Flight Number</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${grid.flight_number || '-'}</td>
    </tr>
    <tr>
      <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Seat Number</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${grid.seat_number || '-'}</td>
    </tr>
    <tr style="background-color: #f9f9f9;">
      <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Source</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${grid.source || '-'}</td>
    </tr>
    <tr>
      <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Destination</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${grid.destination || '-'}</td>
    </tr>
    <tr style="background-color: #f9f9f9;">
      <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Complaint</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${grid.complaint || '-'}</td>
    </tr>
    <tr>
      <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Issue Type</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${grid.issue_type || '-'}</td>
    </tr>
    <tr style="background-color: #f9f9f9;">
      <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Weather Condition</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${grid.weather_condition || '-'}</td>
    </tr>
    <tr>
      <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Date</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${grid.date || '-'}</td>
    </tr>
    ${hasResolution ? `
    <tr style="background-color: #fff3cd;">
      <th colspan="2" style="padding: 12px; text-align: left; font-weight: bold; border: 1px solid #ddd; color: #856404;">
        ✅ RESOLUTION
      </th>
    </tr>
    <tr style="background-color: #fffef7;">
      <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Action Taken</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${grid.action_taken || '-'}</td>
    </tr>
    <tr style="background-color: #f9f9f9;">
      <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Outcome</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${grid.outcome || '-'}</td>
    </tr>
    ${grid.agent_summary ? `
    <tr style="background-color: #fffef7;">
      <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Agent Summary</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${grid.agent_summary}</td>
    </tr>
    ` : ''}
    ${grid.confidence_score !== null && grid.confidence_score !== undefined ? `
    <tr style="background-color: #f9f9f9;">
      <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Confidence Score</td>
      <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: ${grid.confidence_score >= 80 ? '#28a745' : grid.confidence_score >= 60 ? '#ffc107' : '#dc3545'};">
        ${grid.confidence_score}%
      </td>
    </tr>
    ` : ''}
    ` : ''}
  </tbody>
</table>

<!-- For parsing: keep structured text version below -->
<div style="display: none;">
=== INVESTIGATION GRID ===
PNR: ${grid.pnr || '-'}
Customer Name: ${grid.customer_name || '-'}
Flight Number: ${grid.flight_number || '-'}
Seat Number: ${grid.seat_number || '-'}
Source: ${grid.source || '-'}
Destination: ${grid.destination || '-'}
Complaint: ${grid.complaint || '-'}
Issue Type: ${grid.issue_type || '-'}
Weather Condition: ${grid.weather_condition || '-'}
Date: ${grid.date || '-'}
${grid.action_taken ? `Action Taken: ${grid.action_taken}` : ''}
${grid.outcome ? `Outcome: ${grid.outcome}` : ''}
=== END GRID ===
</div>
`;
  }


  /**
   * Parse resolution details from email body.
   * Strategy 1: Look for hidden structured text block (=== INVESTIGATION GRID ===).
   * Strategy 2: Use LLM to extract details from visible text/HTML.
   */
  public async parseResolutionFromEmail(emailBody: string): Promise<Partial<CompleteInvestigationGrid> | null> {
    // Strategy 1: Try Regex (Fast & Exact)
    const gridMatch = emailBody.match(/=== INVESTIGATION GRID ===([\s\S]*?)=== END GRID ===/);
    if (gridMatch) {
      console.log('Found structured grid block. Parsing...');
      const gridText = gridMatch[1];
      const grid: Partial<CompleteInvestigationGrid> = {};

      const extractField = (label: string): string | null => {
        const regex = new RegExp(`${label}:\\s*(.+?)\\s*(?:\n|$)`, 'i');
        const match = gridText.match(regex);
        return match && match[1].trim() !== '-' ? match[1].trim() : null;
      };

      grid.pnr = extractField('PNR');
      grid.customer_name = extractField('Customer Name');
      grid.flight_number = extractField('Flight Number');
      grid.seat_number = extractField('Seat Number');
      grid.source = extractField('Source');
      grid.destination = extractField('Destination');
      grid.complaint = extractField('Complaint');
      grid.issue_type = extractField('Issue Type');
      grid.weather_condition = extractField('Weather Condition');
      grid.date = extractField('Date');
      grid.action_taken = extractField('Action Taken');
      grid.outcome = extractField('Outcome');
      grid.agent_summary = extractField('Agent Summary');

      const scoreMatch = gridText.match(/Confidence Score:\s*(\d+)%?/i);
      if (scoreMatch) {
        grid.confidence_score = parseInt(scoreMatch[1]);
      }

      return grid;
    }

    // Strategy 2: LLM Fallback (Robust for Human Emails)
    console.log('Structured grid not found. Attempting LLM extraction for resolution...');
    const prompt = `
      You are an airline CX agent reading an email from Base Operations.
      Your goal is to extract the resolution details from the email body.
      The email likely contains an HTML table or text with headers like "Action Taken" and "Outcome".
      
      EMAIL BODY:
      ${emailBody.substring(0, 10000)} <!-- Limit context size -->

      RULES:
      1. Identify the "Action Taken" by the ops team.
      2. Identify the "Outcome" or final resolution provided to the customer.
      3. Return NULL if these specific details are not found.

      OUTPUT SCHEMA (JSON):
      {
        "action_taken": "string or null",
        "outcome": "string or null"
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleaned);
      return data;
    } catch (error) {
      console.error('LLM Resolution Extraction Failed:', error);
      return null;
    }
  }

  /**
   * Determine if the complaint should be auto-resolved due to verified adverse weather.
   * AI Logic: Checks if weather is the SOLE cause of the delay/issue.
   */
  public async shouldAutoResolve(complaint: { subject: string, body: string, issue_type: string }, weather: any): Promise<{ shouldResolve: boolean, reason: string, draft: string }> {
    const prompt = `
      You are a senior airline operations manager with strict instructions on force majeure.
      Your goal is to decide if a passenger complaint about a Flight Delay/Turbulence can be auto-resolved based on verified METAR weather data.

      COMPLAINT:
      Subject: ${complaint.subject}
      Body: ${complaint.body}
      Category: ${complaint.issue_type}

      VERIFIED WEATHER DATA (METAR):
      Raw: ${weather.metarRaw}
      Conditions: ${weather.weather || 'None'}
      Visibility: ${weather.visibility || 'N/A'}
      Wind: ${weather.wind || 'N/A'}
      
      RULES:
      1. IF complainant explicitly blames "staff", "crew", "rude", "technical", "maintenance" -> DO NOT AUTO RESOLVE (FALSE).
      2. IF complaint is purely about the delay/weather/turbulence AND weather confirms it -> AUTO RESOLVE (TRUE).
      3. IF weather is good/clear -> DO NOT AUTO RESOLVE (FALSE).

      OUTPUT SCHEMA (JSON):
      {
        "shouldResolve": boolean,
        "reason": "Internal reasoning (e.g. 'Weather confirms Haze, passenger only complained about delay')",
        "draft_response": "Polite email draft to customer apologizing for the weather-related delay (only if TRUE)"
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '');
      const decision = JSON.parse(jsonStr);
      return {
        shouldResolve: decision.shouldResolve,
        reason: decision.reason,
        draft: decision.draft_response
      };
    } catch (error) {
      console.error('Auto-resolve decision failed:', error);
      return { shouldResolve: false, reason: 'AI Error', draft: '' };
    }
  }

  /**
   * Agent 1: Extract initial investigation grid from customer email
   */
  public async extractInvestigationGrid(email: { body: string, subject: string, receivedAt: Date }): Promise<{ grid: Partial<CompleteInvestigationGrid>, confidence: any }> {
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
          "pnr": "string or null (Look for 6-character alphanumeric PNR)",
          "complaint": "string or null (Brief summary of the passenger's complaint)",
          "flight_number": "string or null",
          "date": "YYYY-MM-DD or null",
          "issue_type": "string or null",
          "weather_condition": "string or null"
        },
        "field_confidence": {
          "pnr": "EXPLICIT | INFERRED | MISSING",
          "complaint": "EXPLICIT | INFERRED | MISSING",
          "flight_number": "...",
          "date": "...",
          "issue_type": "...",
          "weather_condition": "..."
        }
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Agent extraction failed:', error);
      return {
        grid: {
          pnr: null,
          complaint: null,
          flight_number: null,
          date: null,
          issue_type: null,
          weather_condition: null
        },
        confidence: {}
      };
    }
  }

  /**
   * Agent 2: Enhance grid with resolution evaluation
   */
  public async enhanceGridWithResolution(
    grid: Partial<CompleteInvestigationGrid>,
    complaint: { subject: string, body: string }
  ): Promise<{ enhanced_grid: Partial<CompleteInvestigationGrid>, status: 'RESOLVED' | 'FLAGGED', draft_response: string }> {
    const prompt = `
      You are Agent 2, a supervisor AI for an airline. 
      Your goal is to evaluate if the resolution from Base Ops adequately addresses the customer's complaint.

      CUSTOMER COMPLAINT:
      Subject: ${complaint.subject}
      Body: ${complaint.body}

      INVESTIGATION GRID WITH BASE OPS RESPONSE:
      ${JSON.stringify(grid, null, 2)}

      RULES:
      1. Review the "action_taken" and "outcome" fields added by Base Ops.
      2. If the action addresses the core complaint issue (e.g. refund processed, bag found, valid explanation), mark as "RESOLVED".
      3. If the action is dismissive, incomplete, or misses the point, mark as "FLAGGED".
      4. Generate:
         - "agent_summary": 1-sentence summary of the resolution (e.g. "Crew validated medical claim and processed complete refund")
         - "confidence_score": 0-100 score (80-100=excellent/green, 60-79=partial/yellow, 0-59=poor/red)
         - "agent_reasoning": Internal note explaining your score
         - "draft_response": Polite email to customer explaining the resolution

      OUTPUT SCHEMA (JSON):
      {
        "status": "RESOLVED" | "FLAGGED",
        "agent_summary": "string",
        "confidence_score": number,
        "agent_reasoning": "string",
        "draft_response": "string"
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '');
      const evaluation = JSON.parse(jsonStr);

      const enhanced_grid = {
        ...grid,
        agent_summary: evaluation.agent_summary,
        confidence_score: evaluation.confidence_score,
        agent_reasoning: evaluation.agent_reasoning
      };

      return {
        enhanced_grid,
        status: evaluation.status,
        draft_response: evaluation.draft_response
      };
    } catch (error) {
      console.error('Agent 2 enhancement failed:', error);
      return {
        enhanced_grid: {
          ...grid,
          agent_summary: 'Error in AI evaluation',
          confidence_score: 0,
          agent_reasoning: 'Agent 2 failed to process resolution'
        },
        status: 'FLAGGED',
        draft_response: 'We are reviewing your complaint and will get back to you shortly.'
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
      return true;
    }
  }
}
