import re
import json
import logging
import random
from datetime import datetime, timedelta

# --- Constants & Configuration ---
CX_EMAIL = "CXINDIGO@minfytech.com"
CR_EMAIL = "CRINDIGO@minfytech.com"

BASE_OPS_EMAILS = {
    'DEL': 'BASEOPSDELHI@minfytech.com',
    'BOM': 'BASEOPSMUMBAI@minfytech.com',
    'BLR': 'BASEOPSBANGALORE@minfytech.com',
    'HYD': 'BASEOPSHYDERABAD@minfytech.com',
    'CCU': 'BASEOPSKOLKATA@minfytech.com',
}

import logging
import json
from datetime import datetime
from llm_util import LLMUtil

# --- Constants & Configuration ---
CX_EMAIL = "CXINDIGO@minfytech.com"
CR_EMAIL = "CRINDIGO@minfytech.com"

BASE_OPS_EMAILS = {
    'DEL': 'BASEOPSDELHI@minfytech.com',
    'BOM': 'BASEOPSMUMBAI@minfytech.com',
    'BLR': 'BASEOPSBANGALORE@minfytech.com',
    'HYD': 'BASEOPSHYDERABAD@minfytech.com',
    'CCU': 'BASEOPSKOLKATA@minfytech.com',
}

class AgentLogic:
    def __init__(self, firestore_util):
        self.firestore = firestore_util
        self.llm = LLMUtil()

    def get_passenger_details(self, pnr):
        """Fetches passenger details from Firestore."""
        if not pnr: return None
        
        try:
            doc = self.firestore.db.collection('passengers').document(pnr).get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logging.error(f"Error fetching passenger {pnr}: {e}")
            return None

    def get_weather_data(self, flight_number, date_str, origin_station):
        """Fetches weather data from Firestore (Mocked Flight Weather)."""
        # Doc ID format: FlightNum_YYYY-MM-DD
        doc_id = f"{flight_number}_{date_str}"
        try:
            doc = self.firestore.db.collection('flight_weather').document(doc_id).get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logging.error(f"Error fetching weather for {doc_id}: {e}")
            return None

    def format_grid_as_html(self, grid_data):
        """Formats the investigation grid as an HTML table."""
        
        # Agent 1: We do NOT show confidence score yet, as that is for the resolution.
        # We leave Action/Outcome/Summary/Score blank for Base Ops to fill or for Agent 2 to compute.

        return f"""
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
            
            <!-- Resolution Section (Empty for Agent 1, to be filled by Base Ops) -->
             <tr style="background-color: #fff3cd;">
              <th colspan="2" style="padding: 12px; text-align: left; font-weight: bold; border: 1px solid #ddd; color: #856404;">
                ✅ RESOLUTION (To be filled by Base Ops)
              </th>
            </tr>
            <tr style="background-color: #fffef7;">
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Action Taken</td>
              <td style="padding: 10px; border: 1px solid #ddd;"></td> <!-- Empty -->
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Outcome</td>
              <td style="padding: 10px; border: 1px solid #ddd;"></td> <!-- Empty -->
            </tr>
             <tr style="background-color: #fffef7;">
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Agent Summary</td>
              <td style="padding: 10px; border: 1px solid #ddd;"></td> <!-- Empty -->
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Confidence Score</td>
              <td style="padding: 10px; border: 1px solid #ddd;"></td> <!-- Empty -->
            </tr>
          </tbody>
        </table>
        
        <!-- Hidden Block for Parsing (Agent 2) -->
        <div style="display: none;">
        === INVESTIGATION GRID ===
        PNR: {grid_data.get('pnr') or '-'}
        Customer Name: {grid_data.get('customer_name') or '-'}
        Flight Number: {grid_data.get('flight_number') or '-'}
        Seat Number: {grid_data.get('seat_number') or '-'}
        Source: {grid_data.get('source') or '-'}
        Destination: {grid_data.get('destination') or '-'}
        Complaint: {grid_data.get('complaint') or '-'}
        Issue Type: {grid_data.get('issue_type') or '-'}
        Weather Condition: {grid_data.get('weather_condition') or '-'}
        Date: {grid_data.get('date') or '-'}
        === END GRID ===
        </div>
        """

    def evaluate_complaint(self, email_data):
        """Main logic to process a complaint."""
        subject = email_data.get('subject', '')
        body = email_data.get('body', '')
        received_at = email_data.get('receivedAt', datetime.now().isoformat())
        
        # 1. LLM Extraction
        extraction = self.llm.extract_investigation_grid(subject, body, received_at)
        pnr = extraction.get('pnr')
        
        # 2. Passenger Lookup
        passenger = self.get_passenger_details(pnr)
        
        # 3. Weather Lookup (If Passenger found)
        weather_info = "-"
        if passenger:
             flight_no = passenger.get('flightNumber')
             flight_date = passenger.get('flightDate')
             origin = passenger.get('source')
             
             weather = self.get_weather_data(flight_no, flight_date, origin)
             if weather:
                 weather_info = f"{weather.get('weather')} (Vis: {weather.get('visibility')})"

        # 4. Construct Complete Grid
        complete_grid = {
            'pnr': pnr,
            'customer_name': passenger.get('customerName') if passenger else None,
            'flight_number': passenger.get('flightNumber') if passenger else extraction.get('flight_number'),
            'seat_number': passenger.get('seatNumber') if passenger else None,
            'source': passenger.get('source') if passenger else None,
            'destination': passenger.get('destination') if passenger else None,
            'complaint': extraction.get('complaint_summary') or subject,
            'issue_type': extraction.get('issue_type'),
            'weather_condition': weather_info,
            'date': passenger.get('flightDate') if passenger else extraction.get('date'),
            'confidence_score': extraction.get('confidence_score', 0)
        }
        
        # 5. Determine Action -> ROUTE_TO_OPS (Standard Flow)
        # Assuming PNR found. If PNR missing, could branch to MISSING_INFO logic (omitted for brevity)
        
        action = 'ROUTE_TO_OPS'
        recipient_email = CR_EMAIL
        
        if passenger:
            source = passenger.get('source', 'DEL')
            recipient_email = BASE_OPS_EMAILS.get(source, CR_EMAIL)
        
        # Format HTML
        grid_html = self.format_grid_as_html(complete_grid)
        cx_case_id_part = f" [Case: {email_data.get('cxCaseId', 'N/A')}]"
        
        draft_subject = f"[ACTION REQUIRED] Investigation Request: {subject} - PNR: {pnr}{cx_case_id_part}"
        
        draft_content = f"""
            <h3>✈️ Action Required: Flight Complaint Investigation</h3>
            <p><strong>Complaint ID:</strong> {email_data.get('cxCaseId', 'N/A')}</p>
            <p><strong>Status:</strong> WAITING_OPS</p>
            
            <h4>Original Complaint</h4>
            <p style="background-color: #f9f9f9; padding: 10px; border-left: 4px solid #0052cc;">{body[:500]}...</p>

            <hr style="border: 1px dashed #ccc; margin: 20px 0;">
            {grid_html}
            <hr style="border: 1px dashed #ccc; margin: 20px 0;">
            
            <h3 style="color: #d9534f;">👇 ACTION REQUIRED 👇</h3>
            <p><strong>Please fill in the RESOLUTION section of the grid table above:</strong></p>
            <ul>
                <li><strong>Action Taken:</strong> What action did the crew take?</li>
                <li><strong>Outcome:</strong> What was the final result/compensation?</li>
            </ul>
            <p><strong>Reply to this email</strong> with the updated grid. The hidden text version will be parsed automatically.</p>
        """

        return {
            'action': action,
            'recipient_email': recipient_email,
            'draft_subject': draft_subject,
            'draft_content': draft_content,
            'metadata': complete_grid
        }
