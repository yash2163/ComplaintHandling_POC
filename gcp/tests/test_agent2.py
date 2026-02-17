import os
import json
import time
from google.cloud import firestore
from google.cloud import pubsub_v1

# Setup
PROJECT_ID = "indigoifs"
TOPIC_ID = "new-resolution"
EMAIL_ID = "TEST_EMAIL_AGT2_001"
CX_CASE_ID = "CASE-AGT2-001"

# Initialize Clients
db = firestore.Client(project=PROJECT_ID)
publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)

def run_test():
    print(f"--- Starting Agent 2 Test ({EMAIL_ID}) ---")

    # 1. Seed Data (Mock Resolution Email)
    html_body = """
    <html>
    <body>
    <p>Dear CX Team,</p>
    <p>Here is the resolution for the complaint.</p>
    <table>
        <tr><td>Compensation</td><td>Voucher 5000 INR</td></tr>
        <tr><td>Delay Reason</td><td>Technical Fault</td></tr>
        <tr><td>Passenger Handling</td><td>Average</td></tr>
    </table>
    </body>
    </html>
    """
    
    email_data = {
        "id": EMAIL_ID,
        "subject": f"Resolution for Case {CX_CASE_ID}",
        "body": html_body,
        "receivedAt": firestore.SERVER_TIMESTAMP,
        "type": "RESOLUTION",
        "status": "NEW",
        "cxCaseId": CX_CASE_ID
    }
    
    print(f"1. Seeding Firestore document: emails/{EMAIL_ID}")
    db.collection("emails").document(EMAIL_ID).set(email_data)
    print("   Data seeded.")

    # 2. Publish Message
    payload = {"emailId": EMAIL_ID, "cxCaseId": CX_CASE_ID}
    data_str = json.dumps(payload).encode("utf-8")
    
    print(f"2. Publishing trigger to {topic_path}")
    future = publisher.publish(topic_path, data_str)
    msg_id = future.result()
    print(f"   Published Message ID: {msg_id}")

    # 3. Monitor Status
    print("3. Monitoring Firestore for status update (timeout 30s)...")
    for _ in range(10):
        doc = db.collection("emails").document(EMAIL_ID).get()
        if doc.exists:
            status = doc.get("status")
            agent_action = doc.get("agentAction")
            print(f"   Current Status: {status}, Action: {agent_action}")
            
            if status == "PROCESSED":
                metadata = doc.get("metadata")
                score = metadata.get("score") if metadata else "N/A"
                print(f"\n✅ SUCCESS: Agent 2 processed the resolution!")
                print(f"   Action: {agent_action}")
                print(f"   Calculated Score: {score}")
                return
        time.sleep(3)
    
    print("\n❌ TIMEOUT: Agent 2 did not update status to PROCESSED.")

if __name__ == "__main__":
    run_test()
