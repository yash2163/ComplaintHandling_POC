#!/bin/bash

PROJECT_ID="indigoifs"
TOKEN=$(gcloud auth print-access-token)
TODAY=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Seed Resolution Email (Reply from Base Ops)
echo "Seeding Email TEST_EMAIL_AGT2_001..."
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/emails/TEST_EMAIL_AGT2_001" \
  -d '{
    "fields": {
      "id": {"stringValue": "TEST_EMAIL_AGT2_001"},
      "subject": {"stringValue": "RE: [ACTION REQUIRED] Investigation Request: Flight Delay [Case: CASE-AGT1-001]"},
      "body": {"stringValue": "Here is the resolution report:\n\nAction Taken: The ground crew distributed water bottles and snacks during the heavy fog delay. Captain made announcements every 30 minutes.\n\nOutcome: Passengers were pacified. No formal compensation offered as delay was due to weather (Force Majeure).\n\nPlease close the case."},
      "receivedAt": {"timestampValue": "'"$TODAY"'"},
      "type": {"stringValue": "RESOLUTION"},
      "status": {"stringValue": "NEW"},
      "cxCaseId": {"stringValue": "CASE-AGT1-001"}
    }
  }'

echo "Seeding Complete."
