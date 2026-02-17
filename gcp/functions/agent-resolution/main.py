import functions_framework
import json
import base64
import os
from google.cloud import firestore
from firestore_util import FirestoreUtil
from outlook import OutlookService
from resolution_logic import ResolutionLogic
from dotenv import load_dotenv

load_dotenv()

TARGET_EMAIL = os.getenv('TARGET_MAILBOX_EMAIL')
firestore_util = FirestoreUtil()
outlook_service = OutlookService()
resolution_logic = ResolutionLogic(firestore_util)

@functions_framework.cloud_event
def process_resolution(cloud_event):
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
        
        print(f"Processing Resolution event for Email ID: {email_id}, Case ID: {cx_case_id}")

        # 2. Fetch Resolution Email from Firestore
        email_doc = firestore_util.db.collection('emails').document(email_id).get()
        if not email_doc.exists:
            print(f"Error: Email document {email_id} not found in Firestore.")
            return
        
        email_data = email_doc.to_dict()

        # 3. Find Original Complaint (Optional but good for context)
        # In a real app, we'd query Firestore for the complaint with this cxCaseId
        # complaint_query = firestore_util.db.collection('emails').where('cxCaseId', '==', cx_case_id).where('type', '==', 'COMPLAINT').limit(1).get()
        # For now, we'll pass empty metadata or try to fetch if needed.
        # Let's simple query:
        original_complaint_data = {}
        complaints = firestore_util.db.collection('emails').where('cxCaseId', '==', cx_case_id).where('type', '==', 'COMPLAINT').limit(1).stream()
        for doc in complaints:
            original_complaint_data = doc.to_dict()
            break
            
        if not original_complaint_data:
            print(f"Warning: Original complaint for Case ID {cx_case_id} not found.")

        # 4. Agent Logic Execution
        outcome = resolution_logic.process_resolution(email_data, original_complaint_data)
        
        # 5. Action: Create Draft
        print(f"Outcome: {outcome['action']} -> Drafting to {outcome['recipient_email']}")
        
        draft = outlook_service.create_draft(
            mailbox_email=TARGET_EMAIL,
            subject=outcome['draft_subject'],
            content=outcome['draft_content'],
            recipient_email=outcome['recipient_email']
        )
        
        # 6. Update Firestore Status (Resolution Email)
        update_data = {
            'status': 'PROCESSED',
            'agentAction': outcome['action'],
            'processedAt': firestore.SERVER_TIMESTAMP,
            'draftId': draft.get('id'),
            'metadata': outcome['metadata']
        }
        firestore_util.db.collection('emails').document(email_id).update(update_data)
        
        # 7. Update Original Complaint Status too (Link the loop)
        if original_complaint_data.get('id'):
             firestore_util.db.collection('emails').document(original_complaint_data['id']).update({
                 'status': 'RESOLVED',
                 'resolutionEmailId': email_id
             })

        print(f"Successfully processed resolution {email_id}. Score: {outcome['metadata']['score']}")

    except Exception as e:
        print(f"Error processing resolution: {e}")
        raise e
