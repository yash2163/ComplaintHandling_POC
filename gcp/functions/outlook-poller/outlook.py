import os
import requests
from azure.identity import ClientSecretCredential
from dotenv import load_dotenv

load_dotenv()

class OutlookService:
    def __init__(self):
        self._validate_env()
        self.token = None
        self.headers = None

    def _validate_env(self):
        required = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET']
        missing = [key for key in required if not os.getenv(key)]
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

    def authenticate(self):
        try:
            credential = ClientSecretCredential(
                tenant_id=os.getenv('AZURE_TENANT_ID'),
                client_id=os.getenv('AZURE_CLIENT_ID'),
                client_secret=os.getenv('AZURE_CLIENT_SECRET')
            )
            token_object = credential.get_token('https://graph.microsoft.com/.default')
            self.token = token_object.token
            self.headers = {
                'Authorization': f'Bearer {self.token}',
                'Content-Type': 'application/json'
            }
        except Exception as e:
            print(f"Authentication Initialization Failed: {e}")
            raise

    def get_folder_id(self, target_email, folder_name):
        if not self.token:
            self.authenticate()
        
        url = f"https://graph.microsoft.com/v1.0/users/{target_email}/mailFolders"
        params = {
            "$filter": f"displayName eq '{folder_name}'",
            "$select": "id"
        }
        
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data.get('value') and len(data['value']) > 0:
                return data['value'][0]['id']
            return None
        except Exception as e:
            print(f"Failed to find folder {folder_name}: {e}")
            return None

    def get_emails_from_folder(self, target_email, folder_id, count=10):
        if not self.token:
            self.authenticate()
            
        url = f"https://graph.microsoft.com/v1.0/users/{target_email}/mailFolders/{folder_id}/messages"
        params = {
            "$top": count,
            "$select": "id,subject,from,receivedDateTime,bodyPreview,body",
            "$filter": "isRead eq false",
            "$orderby": "receivedDateTime DESC"
        }
        
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json().get('value', [])
        except Exception as e:
            print(f"Failed to fetch emails from folder {folder_id}: {e}")
            raise

    def mark_as_read(self, target_email, message_id):
        if not self.token:
            self.authenticate()
            
        url = f"https://graph.microsoft.com/v1.0/users/{target_email}/messages/{message_id}"
        payload = {"isRead": True}
        
        try:
            response = requests.patch(url, headers=self.headers, json=payload)
            response.raise_for_status()
        except Exception as e:
            print(f"Failed to mark email {message_id} as read: {e}")
