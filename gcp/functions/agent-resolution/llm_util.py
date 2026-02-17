import os
import json
import logging
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
else:
    logging.warning("GOOGLE_API_KEY not found. LLM features will fail.")

class LLMUtil:
    def __init__(self):
        # Using Gemini 2.5 Flash as per local implementation
        self.model = genai.GenerativeModel('gemini-2.5-flash', 
                                           generation_config={"response_mime_type": "application/json"})

    def extract_investigation_grid(self, subject, body, received_at):
        """Extracts PNR, Issue Type, and Summary from email."""
        prompt = f"""
        You are a specialized data extraction agent for an airline CX team.
        Your goal is to extract specific facts from the email below into a structured JSON grid.
        
        RULES:
        1. Extract ONLY explicitly stated facts. Do not guess or infer.
        2. If a field is not explicitly mentioned, return null.
        3. For 'issue_type', categorize into: 'FLIGHT_DELAY', 'CANCELLATION', 'STAFF_BEHAVIOR', 'BAGGAGE', 'REFUND', 'OTHER'.
        4. For 'weather_condition', only extract if the user explicitly mentions weather causing the issue.

        EMAIL CONTENT:
        Subject: {subject}
        Body: {body}
        Received At: {received_at}

        OUTPUT SCHEMA (JSON):
        {{
            "pnr": "string or null (Look for 6-character alphanumeric PNR)",
            "complaint_summary": "string or null (Brief summary of the passenger's complaint)",
            "flight_number": "string or null",
            "date": "YYYY-MM-DD or null",
            "issue_type": "string or null",
            "weather_condition": "string or null",
            "confidence_score": "number (0-100)"
        }}
        """
        
        try:
            response = self.model.generate_content(prompt)
            return json.loads(response.text)
        except Exception as e:
            logging.error(f"LLM Extraction Failed: {e}")
            return {
                "pnr": None, "issue_type": "OTHER", "confidence_score": 0
            }

    def parse_resolution_grid(self, email_body):
        """Extracts Resolution details (Action Taken, Outcome) from email."""
        prompt = f"""
        You are an airline CX agent reading an email from Base Operations.
        Your goal is to extract the resolution details from the email body.
        The email likely contains an HTML table or text with headers like "Action Taken" and "Outcome".
        
        EMAIL BODY:
        {email_body[:10000]}

        RULES:
        1. Identify the "Action Taken" by the ops team.
        2. Identify the "Outcome" or final resolution provided to the customer.
        3. Return NULL if these specific details are not found.

        OUTPUT SCHEMA (JSON):
        {{
            "action_taken": "string or null",
            "outcome": "string or null"
        }}
        """
        try:
            response = self.model.generate_content(prompt)
            return json.loads(response.text)
        except Exception as e:
            logging.error(f"LLM Resolution Parsing Failed: {e}")
            return {"action_taken": None, "outcome": None}

    def evaluate_resolution(self, complaint_summary, resolution_grid):
        """Evaluates resolution quality and generates a score."""
        prompt = f"""
        You are Agent 2, a supervisor AI for an airline. 
        Your goal is to evaluate if the resolution from Base Ops adequately addresses the customer's complaint.

        COMPLAINT SUMMARY:
        {complaint_summary}

        RESOLUTION FROM BASE OPS:
        {json.dumps(resolution_grid)}

        RULES:
        1. Review "action_taken" and "outcome".
        2. If the action addresses the core complaint issue, give high score.
        3. If dismissive or incomplete, give low score.
        4. Generate a polite email response to the customer.

        OUTPUT SCHEMA (JSON):
        {{
            "status": "RESOLVED" | "FLAGGED",
            "agent_summary": "1-sentence summary of resolution",
            "confidence_score": number (0-100),
            "agent_reasoning": "Internal note explaining score",
            "draft_response": "Polite email body to customer (HTML format)"
        }}
        """
        try:
            response = self.model.generate_content(prompt)
            return json.loads(response.text)
        except Exception as e:
            logging.error(f"LLM Evaluation Failed: {e}")
            return {
                "status": "FLAGGED",
                "confidence_score": 0,
                "agent_summary": "AI Error",
                "draft_response": "Error generating draft."
            }
