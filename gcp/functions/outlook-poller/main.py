import functions_framework
import os
import re
from outlook import OutlookService
from firestore_util import FirestoreUtil
from pubsub_util import PubSubUtil
from dotenv import load_dotenv

load_dotenv()

TARGET_EMAIL = os.getenv('TARGET_MAILBOX_EMAIL')
TOPIC_COMPLAINT = 'new-complaint'
TOPIC_RESOLUTION = 'new-resolution'

outlook_service = OutlookService()
firestore_util = FirestoreUtil()
pubsub_util = PubSubUtil()

def extract_cx_case_id(subject, body):
    # Subject regex
    subject_match = re.search(r'\[Case:\s*([a-zA-Z0-9\-]+)\]', subject, re.IGNORECASE)
    if subject_match:
        return subject_match.group(1)
    
    # Body regex
    body_match = re.search(r'Case ID:\s*([a-zA-Z0-9\-]+)', body, re.IGNORECASE)
    if body_match:
        return body_match.group(1)
    
    return None

@functions_framework.http
def poll_outlook(request):
    if not TARGET_EMAIL:
        print('TARGET_MAILBOX_EMAIL not set')
        return 'Configuration Error', 500

    try:
        print('Starting Poll Cycle...')
        
        # 1. Get Folder IDs
        complaints_folder_id = outlook_service.get_folder_id(TARGET_EMAIL, 'Complaints')
        resolutions_folder_id = outlook_service.get_folder_id(TARGET_EMAIL, 'Resolutions')

        if not complaints_folder_id or not resolutions_folder_id:
            raise ValueError('Required folders not found')

        processed_count = 0

        # 2. Process Complaints
        complaints = outlook_service.get_emails_from_folder(TARGET_EMAIL, complaints_folder_id)
        for msg in complaints:
            msg_id = msg.get('id')
            if firestore_util.email_exists(msg_id):
                continue

            subject = msg.get('subject', '')
            body_content = msg.get('body', {}).get('content') or msg.get('bodyPreview') or ''
            
            cx_case_id = extract_cx_case_id(subject, body_content)
            
            email_data = {
                'id': msg_id,
                'subject': subject,
                'receivedAt': msg.get('receivedDateTime'),
                'body': body_content,
                'type': 'COMPLAINT',
                'status': 'NEW',
                'cxCaseId': cx_case_id
            }

            firestore_util.save_email(email_data)
            pubsub_util.publish_message(TOPIC_COMPLAINT, {'emailId': msg_id, 'cxCaseId': cx_case_id})
            outlook_service.mark_as_read(TARGET_EMAIL, msg_id)
            processed_count += 1

        # 3. Process Resolutions
        resolutions = outlook_service.get_emails_from_folder(TARGET_EMAIL, resolutions_folder_id)
        for msg in resolutions:
            msg_id = msg.get('id')
            if firestore_util.email_exists(msg_id):
                continue

            subject = msg.get('subject', '')
            body_content = msg.get('body', {}).get('content') or msg.get('bodyPreview') or ''
            
            cx_case_id = extract_cx_case_id(subject, body_content)

            if not cx_case_id:
                print(f"Skipping resolution email without Case ID: {subject}")
                continue

            email_data = {
                'id': msg_id,
                'subject': subject,
                'receivedAt': msg.get('receivedDateTime'),
                'body': body_content,
                'type': 'RESOLUTION',
                'status': 'NEW',
                'cxCaseId': cx_case_id
            }

            firestore_util.save_email(email_data)
            pubsub_util.publish_message(TOPIC_RESOLUTION, {'emailId': msg_id, 'cxCaseId': cx_case_id})
            outlook_service.mark_as_read(TARGET_EMAIL, msg_id)
            processed_count += 1

        return f'Polled successfully. Processed {processed_count} new emails.', 200

    except Exception as e:
        print(f'Error in poll_outlook: {e}')
        return 'Internal Server Error', 500
