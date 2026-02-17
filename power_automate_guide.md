# Power Automate Configuration Guide

This guide explains how to configure Microsoft Power Automate to trigger the `outlook-poller` Cloud Function, which fetches new emails and starts the agent workflows.

## Prerequisites
-   **Endpoint URL**: `https://outlook-poller-33pbux2oca-uc.a.run.app`
-   **Method**: `GET`
-   **Authentication**: The function accepts authenticated requests. You need to ensure the request includes an Authorization header if the function is not public.

## Steps to Configure

1.  **Create a New Flow**
    -   Go to [make.powerautomate.com](https://make.powerautomate.com/)
    -   Click **+ Create** -> **Scheduled cloud flow**.
    -   **Name**: "Indigo POC Poller"
    -   **Repeat every**: `5` Minutes (or as desired).
    -   Click **Create**.

2.  **Add HTTP Action**
    -   Click **+ New Step**.
    -   Search for **"HTTP"** and select the **HTTP (Premium)** action.
    -   **Method**: `GET`
    -   **URI**: `https://outlook-poller-33pbux2oca-uc.a.run.app`
    
3.  **Authentication (Crucial)**
    -   *Option A (Public Access)*: If you were able to make the function public (allow unauthenticated), no extra headers are needed.
    -   *Option B (Authenticated)*: You must include an `Authorization` header.
        -   **Key**: `Authorization`
        -   **Value**: `Bearer <YOUR_IDENTITY_TOKEN>`
        -   *Note*: Generating a GCP Identity Token within Power Automate requires advanced setup (e.g., using a Service Account Key to request a token first).
    
    > **Recommendation for POC**: If possible, ask your administrator to allow unauthenticated invocations for this specific function URL, or run the poller manually/via local script for demonstrations.

4.  **Save and Test**
    -   Click **Save**.
    -   Click **Test** -> **Manually**.
    -   Verify the run confirms "Polled successfully".

## Alternative: Local Trigger
You can also trigger the poller manually from your terminal using the provided script:
```bash
bash gcp/scripts/trigger_poller.sh
```
