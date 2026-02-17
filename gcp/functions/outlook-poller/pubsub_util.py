import json
from google.cloud import pubsub_v1

class PubSubUtil:
    def __init__(self):
        self.publisher = pubsub_v1.PublisherClient()
        # Project ID should ideally be fetched from env, but PublisherClient usually handles default creds/project
        # We need to construct the topic path: projects/{project_id}/topics/{topic}
        # For POC, we'll assume project_id is available or part of the topic_name passed in if full path
        # Or we fetch GOOGLE_CLOUD_PROJECT
        import os
        self.project_id = os.getenv('GCP_PROJECT_ID') or os.getenv('GOOGLE_CLOUD_PROJECT')

    def publish_message(self, topic_name, data):
        if not self.project_id:
             print("GCP_PROJECT_ID not set, cannot publish.")
             return

        topic_path = self.publisher.topic_path(self.project_id, topic_name)
        data_str = json.dumps(data)
        data_bytes = data_str.encode("utf-8")

        try:
            future = self.publisher.publish(topic_path, data_bytes)
            message_id = future.result()
            print(f"Message {message_id} published to topic {topic_name}.")
        except Exception as e:
            print(f"Error publishing to topic {topic_name}: {e}")
            raise
