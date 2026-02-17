#!/bin/bash

# IDs
COMPLAINT_EMAIL_ID="TEST_EMAIL_FIX_002"
RESOLUTION_EMAIL_ID="TEST_EMAIL_FIX_RES_002"
CX_CASE_ID="CASE-FIX-002"
PNR="FIX002"

PROJECT_ID="indigoifs"
TOKEN=$(gcloud auth print-access-token)
TODAY=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "--- 1. Seeding Data for Agent 1 ---"

# Passenger
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/passengers/$PNR" \
  -d '{
    "fields": {
      "pnr": {"stringValue": "'"$PNR"'"},
      "customerName": {"stringValue": "Fix Tester"},
      "email": {"stringValue": "fix@example.com"},
      "seatNumber": {"stringValue": "2D"},
      "source": {"stringValue": "DEL"},
      "destination": {"stringValue": "BOM"},
      "flightNumber": {"stringValue": "6E-888"},
      "flightDate": {"stringValue": "2026-02-19"}
    }
  }'

# Complaint Email
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/emails/$COMPLAINT_EMAIL_ID" \
  -d '{
    "fields": {
      "id": {"stringValue": "'"$COMPLAINT_EMAIL_ID"'"},
      "cxCaseId": {"stringValue": "'"$CX_CASE_ID"'"},
      "subject": {"stringValue": "Meal not served PNR '"$PNR"'"},
      "body": {"stringValue": "I did not receive my pre-booked meal on 6E-888. PNR '"$PNR"'."},
      "receivedAt": {"timestampValue": "'"$TODAY"'"},
      "type": {"stringValue": "COMPLAINT"},
      "status": {"stringValue": "NEW"}
    }
  }'

echo "--- 2. Triggering Agent 1 ---"
gcloud pubsub topics publish new-complaint --message='{"emailId": "'"$COMPLAINT_EMAIL_ID"'", "cxCaseId": "'"$CX_CASE_ID"'"}'

echo "--- 3. Waiting 15 seconds for Agent 1 to process... ---"
sleep 15

echo "--- 4. Seeding Data for Agent 2 ---"

# Resolution Email
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/emails/$RESOLUTION_EMAIL_ID" \
  -d '{
    "fields": {
      "id": {"stringValue": "'"$RESOLUTION_EMAIL_ID"'"},
      "cxCaseId": {"stringValue": "'"$CX_CASE_ID"'"},
      "subject": {"stringValue": "RE: Meal Complaint"},
      "body": {"stringValue": "Action Taken: Crew checked manifest. Meal was not booked.\nOutcome: Explained to passenger. Sold buy-on-board meal."},
      "receivedAt": {"timestampValue": "'"$TODAY"'"},
      "type": {"stringValue": "RESOLUTION"},
      "status": {"stringValue": "NEW"}
    }
  }'

echo "--- 5. Triggering Agent 2 ---"
gcloud pubsub topics publish new-resolution --message='{"emailId": "'"$RESOLUTION_EMAIL_ID"'", "cxCaseId": "'"$CX_CASE_ID"'"}'
