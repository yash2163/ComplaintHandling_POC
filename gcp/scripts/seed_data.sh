#!/bin/bash

PROJECT_ID="indigoifs"
TOKEN=$(gcloud auth print-access-token)

# 1. Seed Passenger (PNR ABC123)
echo "Seeding Passenger ABC123..."
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/passengers/ABC123" \
  -d '{
    "fields": {
      "pnr": {"stringValue": "ABC123"},
      "customerName": {"stringValue": "John Doe"},
      "email": {"stringValue": "john.doe@example.com"},
      "phone": {"stringValue": "+919876543210"},
      "flightNumber": {"stringValue": "6E-123"},
      "flightDate": {"stringValue": "'"$(date +%Y-%m-%d)"'"},
      "seatNumber": {"stringValue": "12A"},
      "source": {"stringValue": "DEL"},
      "destination": {"stringValue": "BOM"}
    }
  }'

# 2. Seed Weather (Flight 6E-123 from DEL)
TODAY=$(date +%Y-%m-%d)
DOC_ID="6E-123_$TODAY"
echo "Seeding Weather $DOC_ID..."
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/flight_weather/$DOC_ID" \
  -d '{
    "fields": {
      "flightNumber": {"stringValue": "6E-123"},
      "originStation": {"stringValue": "DEL"},
      "date": {"stringValue": "'"$TODAY"'"},
      "metarRaw": {"stringValue": "VIDP 162330Z 00000KT 1000 R28/1500D FG VV002 12/11 Q1013 NOSIG"},
      "weather": {"stringValue": "Fog"},
      "visibility": {"stringValue": "1000m"},
      "wind": {"stringValue": "00000KT"},
      "impact": {"stringValue": "HIGH"}
    }
  }'

# 3. Seed Email (The Complaint)
echo "Seeding Email TEST_EMAIL_AGT1_001..."
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/emails/TEST_EMAIL_AGT1_001" \
  -d '{
    "fields": {
      "id": {"stringValue": "TEST_EMAIL_AGT1_001"},
      "subject": {"stringValue": "Flight Delay Complaint for PNR ABC123 [Case: CASE-AGT1-001]"},
      "body": {"stringValue": "My flight 6E-123 from DEL to BOM was delayed by 4 hours. PNR ABC123. Please compensate."},
      "receivedAt": {"timestampValue": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"},
      "type": {"stringValue": "COMPLAINT"},
      "status": {"stringValue": "NEW"},
      "cxCaseId": {"stringValue": "CASE-AGT1-001"}
    }
  }'

echo "Seeding Complete."
