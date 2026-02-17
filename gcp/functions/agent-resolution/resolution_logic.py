import re
from bs4 import BeautifulSoup
from datetime import datetime

# Constants
CX_EMAIL = "CXINDIGO@minfytech.com"

class ResolutionLogic:
    def __init__(self, firestore_util):
        self.firestore = firestore_util

import logging
import json
from datetime import datetime
from llm_util import LLMUtil

# Constants
CX_EMAIL = "CXINDIGO@minfytech.com"

class ResolutionLogic:
    def __init__(self, firestore_util):
        self.firestore = firestore_util
        self.llm = LLMUtil()

    def format_full_grid_as_html(self, grid_data, resolution_grid, evaluation):
        """Formats the COMPLETE investigation grid as an HTML table."""
        
        # Color code confidence
        conf_score = evaluation.get('confidence_score', 0)
        conf_color = '#28a745' if conf_score >= 80 else '#ffc107' if conf_score >= 60 else '#dc3545'

        return f"""
        <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; margin: 20px 0;">
          <thead>
            <tr style="background-color: #0052cc; color: white;">
              <th colspan="2" style="padding: 12px; text-align: left; font-size: 16px; border: 1px solid #ddd;">
                📋 COMPLETED INVESTIGATION GRID
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd; width: 180px;">PNR</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{grid_data.get('pnr') or '-'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Customer Name</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{grid_data.get('customer_name') or '-'}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Flight Number</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{grid_data.get('flight_number') or '-'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Seat Number</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{grid_data.get('seat_number') or '-'}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Source</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{grid_data.get('source') or '-'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Destination</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{grid_data.get('destination') or '-'}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Complaint</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{grid_data.get('complaint') or '-'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Issue Type</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{grid_data.get('issue_type') or '-'}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Weather Condition</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{grid_data.get('weather_condition') or '-'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Date</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{grid_data.get('date') or '-'}</td>
            </tr>
            
            <!-- Resolution Section (FILLED by Agent 2) -->
             <tr style="background-color: #fff3cd;">
              <th colspan="2" style="padding: 12px; text-align: left; font-weight: bold; border: 1px solid #ddd; color: #856404;">
                ✅ RESOLUTION & ANALYSIS
              </th>
            </tr>
            <tr style="background-color: #fffef7;">
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Action Taken</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{resolution_grid.get('action_taken') or 'Not Found'}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Outcome</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{resolution_grid.get('outcome') or 'Not Found'}</td>
            </tr>
             <tr style="background-color: #fffef7;">
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Agent Summary</td>
              <td style="padding: 10px; border: 1px solid #ddd;">{evaluation.get('agent_summary') or '-'}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Confidence Score</td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: {conf_color};">
                {conf_score}% (Reasoning: {evaluation.get('agent_reasoning') or '-'})
              </td>
            </tr>
          </tbody>
        </table>
        """

    def process_resolution(self, email_data, original_complaint_data):
        """Main logic to process a resolution email."""
        
        # 1. Parse Body using LLM (to find Action Taken/Outcome)
        email_body = email_data.get('body', '')
        resolution_grid = self.llm.parse_resolution_grid(email_body)
        
        # 2. Get Context from Original Complaint
        metadata = {}
        if original_complaint_data:
             metadata = original_complaint_data.get('metadata', {})
        
        complaint_summary = metadata.get('complaint') or "Passenger Complaint"
        pnr = metadata.get('pnr', 'N/A')
        customer_name = metadata.get('customer_name', 'N/A')
        cx_case_id = email_data.get('cxCaseId', 'N/A')
        
        logging.info(f"Context Found - Case: {cx_case_id}, PNR: {pnr}, Customer: {customer_name}")
        
        # 3. Evaluate Resolution using LLM
        evaluation = self.llm.evaluate_resolution(complaint_summary, resolution_grid)
        
        score = evaluation.get('confidence_score', 0)
        status = evaluation.get('status', 'FLAGGED')
        
        # 4. Formulate Response
        result = {
            'action': status, # RESOLVED or FLAGGED
            'recipient_email': CX_EMAIL, # Final review by CX
            'draft_subject': f"[FINAL DRAFT] Response for Case {cx_case_id} (Score: {score}/100)",
            'draft_content': "",
            'metadata': {
                'score': score,
                'resolution_grid': resolution_grid,
                'evaluation': evaluation
            }
        }
        
        # Generate the Full Grid HTML
        full_grid_html = self.format_full_grid_as_html(metadata, resolution_grid, evaluation)
        
        # Construct Email Body
        result['draft_content'] = (
            f"<p>Dear CX Team,</p>"
            f"<p>Base Ops has submitted their resolution. Agent 2 has analyzed it below.</p>"
            
            f"{full_grid_html}"
            
            f"<hr/>"
            f"<h4>Proposed Customer Response:</h4>"
            f"<div style='border-left: 3px solid #0052cc; padding-left: 10px; font-style: italic; background-color: #f0f4f8; padding: 10px;'> "
            f"{evaluation.get('draft_response')}"
            f"</div>"
            
            f"<p>System Recommendation: <b>{'Approve & Send' if status == 'RESOLVED' else 'Review Required'}</b></p>"
        )
        
        return result

