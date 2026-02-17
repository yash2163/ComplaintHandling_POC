import logging
import base64
import json
import os
import sys

# Add the function directory to sys.path so we can import main
sys.path.append(os.path.join(os.getcwd(), 'gcp/functions/agent-complaint'))

from main import process_complaint
from google.cloud import firestore

# Mock CloudEvent
class CloudEvent:
    def __init__(self, data):
        self.data = data

def debug_agent1():
    # Setup
    email_id = "TEST_EMAIL_AGT1_001"
    cx_case_id = "CASE-AGT1-001"
    
    print(f"--- Debugging Agent 1 Locally ({email_id}) ---")

    # 1. Create/Ensure Firestore Data Exists (Simulating Poller)
    db = firestore.Client(project="indigoifs")
    email_data = {
        "id": email_id,
        "subject": f"Flight Delay Complaint for PNR ABC123 [Case: {cx_case_id}]",
        "body": "My flight 6E-123 from DEL to BOM was delayed by 4 hours. PNR ABC123. Please compensate.",
        "receivedAt": datetime.now().isoformat(),
        "type": "COMPLAINT",
        "status": "NEW",
        "cxCaseId": cx_case_id
    }
    db.collection("emails").document(email_id).set(email_data)
    print("1. Seeded Firestore email doc.")

    # 2. Construct Pub/Sub Message
    payload = {"emailId": email_id, "cxCaseId": cx_case_id}
    data_str = json.dumps(payload)
    data_b64 = base64.b64encode(data_str.encode('utf-8')).decode('utf-8')
    
    event = CloudEvent(data={
        'message': {
            'data': data_b64
        }
    })

    # 3. Invoke Function directly
    print("2. Invoking process_complaint()...")
    try:
        from datetime import datetime
        process_complaint(event)
        print("✅ Function returned successfully.")
    except Exception as e:
        print(f"❌ Function failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    debug_agent1()
