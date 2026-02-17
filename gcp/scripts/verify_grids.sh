#!/bin/bash

# IDs
COMPLAINT_EMAIL_ID="TEST_EMAIL_GRID_001"
RESOLUTION_EMAIL_ID="TEST_EMAIL_GRID_RES_001"
CX_CASE_ID="CASE-GRID-001"
PNR="GRID01"

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
      "customerName": {"stringValue": "Grid Tester"},
      "email": {"stringValue": "tester@example.com"},
      "seatNumber": {"stringValue": "1F"},
      "source": {"stringValue": "DEL"},
      "destination": {"stringValue": "BOM"},
      "flightNumber": {"stringValue": "6E-999"},
      "flightDate": {"stringValue": "2026-02-18"}
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
      "subject": {"stringValue": "Broken Seat Complaint PNR '"$PNR"'"},
      "body": {"stringValue": "My seat 1F was broken on flight 6E-999. PNR '"$PNR"'."},
      "receivedAt": {"timestampValue": "'"$TODAY"'"},
      "type": {"stringValue": "COMPLAINT"},
      "status": {"stringValue": "NEW"}
    }
  }'

echo "--- 2. Triggering Agent 1 ---"
gcloud pubsub topics publish new-complaint --message='{"emailId": "'"$COMPLAINT_EMAIL_ID"'", "cxCaseId": "'"$CX_CASE_ID"'"}'


echo "--- 3. Seeding Data for Agent 2 ---"

# Resolution Email
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/emails/$RESOLUTION_EMAIL_ID" \
  -d '{
    "fields": {
      "id": {"stringValue": "'"$RESOLUTION_EMAIL_ID"'"},
      "cxCaseId": {"stringValue": "'"$CX_CASE_ID"'"},
      "subject": {"stringValue": "RE: Broken Seat Complaint"},
      "body": {"stringValue": "Action Taken: Crew verified seat was broken. Moved passenger to 2F.\nOutcome: Passenger satisfied. 50$ voucher given."},
      "receivedAt": {"timestampValue": "'"$TODAY"'"},
      "type": {"stringValue": "RESOLUTION"},
      "status": {"stringValue": "NEW"}
    }
  }'

echo "--- 4. Triggering Agent 2 ---"
gcloud pubsub topics publish new-resolution --message='{"emailId": "'"$RESOLUTION_EMAIL_ID"'", "cxCaseId": "'"$CX_CASE_ID"'"}'
