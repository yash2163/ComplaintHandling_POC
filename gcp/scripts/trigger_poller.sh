#!/bin/bash

# Configuration
FUNCTION_URL="https://outlook-poller-33pbux2oca-uc.a.run.app"
PROJECT_ID="indigoifs"

echo "--- Triggering Outlook Poller ---"
echo "URL: $FUNCTION_URL"

# Get Identity Token
TOKEN=$(gcloud auth print-identity-token)

# Call the Function
curl -X GET "$FUNCTION_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

echo -e "\n\n--- Poller Triggered ---"
echo "Check Cloud Functions logs for 'outlook-poller', 'agent-complaint', and 'agent-resolution'."
