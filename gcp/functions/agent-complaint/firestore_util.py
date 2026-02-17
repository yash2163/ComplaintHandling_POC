from google.cloud import firestore
from datetime import datetime

class FirestoreUtil:
    def __init__(self):
        self.db = firestore.Client()
        self.collection_name = 'emails'

    def email_exists(self, message_id):
        doc_ref = self.db.collection(self.collection_name).document(message_id)
        doc = doc_ref.get()
        return doc.exists

    def save_email(self, data):
        """
        data: dict containing id, subject, receivedAt, body, type, status, cxCaseId
        """
        data['savedAt'] = datetime.utcnow()
        self.db.collection(self.collection_name).document(data['id']).set(data)
        print(f"Saved email {data['id']} to Firestore.")
