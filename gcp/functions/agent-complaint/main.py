import functions_framework
import json
import base64
import os
from google.cloud import firestore # Added import
from firestore_util import FirestoreUtil
from outlook import OutlookService
from agent_logic import AgentLogic
from dotenv import load_dotenv

load_dotenv()

TARGET_EMAIL = os.getenv('TARGET_MAILBOX_EMAIL')
firestore_util = FirestoreUtil()
outlook_service = OutlookService()
agent_logic = AgentLogic(firestore_util)

@functions_framework.cloud_event
def process_complaint(cloud_event):
    """Triggered from a message on a Cloud Pub/Sub topic."""
    
    if not TARGET_EMAIL:
         print("Configuration Error: TARGET_MAILBOX_EMAIL not set.")
         return

    try:
        # 1. Decode Pub/Sub Message
        pubsub_message = cloud_event.data['message']
        data_str = base64.b64decode(pubsub_message['data']).decode('utf-8')
        event_data = json.loads(data_str)
        
        email_id = event_data.get('emailId')
        cx_case_id = event_data.get('cxCaseId')
        
        print(f"Processing Complaint event for Email ID: {email_id}, Case ID: {cx_case_id}")

        # 2. Fetch Full Email from Firestore
        #    (We use the ID to get the full body/subject stored by the Poller)
        email_doc = firestore_util.db.collection('emails').document(email_id).get()
        if not email_doc.exists:
            print(f"Error: Email document {email_id} not found in Firestore.")
            return
        
        email_data = email_doc.to_dict()
        # Merge cxCaseId if not in doc (though poller should have put it there)
        if not email_data.get('cxCaseId') and cx_case_id:
            email_data['cxCaseId'] = cx_case_id

        # 3. Agent Logic Execution
        outcome = agent_logic.evaluate_complaint(email_data)
        
        # 4. Action: Create Draft
        print(f"Outcome: {outcome['action']} -> Drafting to {outcome['recipient_email']}")
        
        awaiting_action = True # Default to waiting for action unless fully resolved
        
        if outcome['action'] == 'AUTO_RESOLVE':
             awaiting_action = False # Resolved
        
        # Create Draft in "Drafts" folder (default) or send directly?
        # User requirement was "Draft email for...". Outlook `createDraft` puts it in Drafts.
        draft = outlook_service.create_draft(
            mailbox_email=TARGET_EMAIL,
            subject=outcome['draft_subject'],
            content=outcome['draft_content'],
            recipient_email=outcome['recipient_email']
        )
        
        # 5. Update Firestore Status
        update_data = {
            'status': 'PROCESSED', # Or specific status like 'WAITING_OPS'
            'agentAction': outcome['action'],
            'processedAt': firestore.SERVER_TIMESTAMP, # Fixed usage
            'draftId': draft.get('id'), # Store draft ID if returned
            'metadata': outcome['metadata']
        }
        
        firestore_util.db.collection('emails').document(email_id).update(update_data)
        print(f"Successfully processed complaint {email_id}. Action: {outcome['action']}")

    except Exception as e:
        print(f"Error processing complaint: {e}")
        # Ideally enable retries or Dead Letter Queue here
        raise e
