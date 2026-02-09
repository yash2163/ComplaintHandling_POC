# GCP Migration - Quick Start Guide

This guide will help you get started with the GCP deployment in the next 30 minutes.

## ✅ Prerequisites Checklist

- [ ] GCP account with billing enabled
- [ ] Existing GCP project (as you mentioned)
- [ ] gcloud CLI installed ([Install Guide](https://cloud.google.com/sdk/docs/install))
- [ ] Docker installed
- [ ] Azure App Registration with `Mail.Read` and `Mail.ReadWrite` permissions
- [ ] Access to the target Outlook mailbox

## 🚀 30-Minute Setup

### Step 1: Configure GCP (5 minutes)

```bash
# Login to GCP
gcloud auth login

# Set your project
export GCP_PROJECT_ID="your-project-id"
gcloud config set project $GCP_PROJECT_ID

# Enable required APIs (takes ~2 minutes)
gcloud services enable \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com

# Initialize Firestore (choose us-central1 when prompted)
gcloud firestore databases create --region=us-central1
```

### Step 2: Store Secrets (3 minutes)

```bash
# Replace with your actual Azure credentials
echo -n "YOUR_TENANT_ID" | gcloud secrets create azure-tenant --data-file=-
echo -n "YOUR_CLIENT_ID" | gcloud secrets create azure-client --data-file=-
echo -n "YOUR_CLIENT_SECRET" | gcloud secrets create azure-secret --data-file=-
echo -n "your-email@example.com" | gcloud secrets create target-email --data-file=-

# Grant permissions to the default compute service account
PROJECT_NUMBER=$(gcloud projects describe $GCP_PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SECRET in azure-tenant azure-client azure-secret target-email; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"
done
```

### Step 3: Set Up Outlook Folders (2 minutes)

1. Log into Outlook with your target mailbox
2. Create two new folders:
   - **Complaints** (for customer complaint emails)
   - **Resolutions** (for Base Ops responses)
3. Move a test complaint email into the Complaints folder

### Step 4: Test Locally (10 minutes)

```bash
cd gcp-deployment

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Update `.env`:
```bash
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
TARGET_MAILBOX_EMAIL=your-email@example.com
```

```bash
# Build TypeScript
npm run build

# Run worker locally (will connect to GCP Firestore)
npm run dev
```

You should see:
```
🔧 Initializing Complaint Worker...
✅ Outlook connection successful
✅ Worker initialized successfully
🚀 Starting Complaint Worker...
⏰ Polling every 60 seconds
📧 Fetching complaint emails...
```

### Step 5: Deploy to Cloud Run (10 minutes)

```bash
# Create Artifact Registry repository
gcloud artifacts repositories create indigo-app \
  --repository-format=docker \
  --location=us-central1

# Authenticate Docker
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build and push image
docker build -t us-central1-docker.pkg.dev/$GCP_PROJECT_ID/indigo-app/worker:latest .
docker push us-central1-docker.pkg.dev/$GCP_PROJECT_ID/indigo-app/worker:latest

# Deploy to Cloud Run
gcloud run deploy indigo-worker \
  --image=us-central1-docker.pkg.dev/$GCP_PROJECT_ID/indigo-app/worker:latest \
  --platform=managed \
  --region=us-central1 \
  --no-allow-unauthenticated \
  --min-instances=1 \
  --max-instances=3 \
  --memory=512Mi \
  --cpu=1 \
  --set-env-vars="GCP_PROJECT_ID=$GCP_PROJECT_ID" \
  --set-secrets="AZURE_TENANT_ID=azure-tenant:latest,AZURE_CLIENT_ID=azure-client:latest,AZURE_CLIENT_SECRET=azure-secret:latest,TARGET_MAILBOX_EMAIL=target-email:latest"
```

## 🧪 Verify Deployment

### Check Firestore Data

```bash
# List all collections (should see 'complaints' after processing an email)
gcloud firestore export gs://your-bucket/export --async

# Or use Firebase Console:
# https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore
```

### View Logs

```bash
# View recent logs
gcloud run logs read indigo-worker --region=us-central1 --limit=50

# Stream logs in real-time
gcloud run logs tail indigo-worker --region=us-central1
```

### Test with Real Email

1. Send a test complaint to your mailbox
2. Move it to the "Complaints" folder
3. Wait ~60 seconds for the worker to poll
4. Check Firestore Console - you should see:
   - New document in `complaints` collection with ID like `CMP-2026-0001`
   - New document in `agent_logs` collection showing Agent 1 activity

### Send Test Resolution

1. Create a reply email with subject: `Re: Complaint CMP-2026-0001`
2. Move it to the "Resolutions" folder
3. Wait ~60 seconds
4. Check Firestore - you should see:
   - New document in `resolutions` collection
   - Updated complaint status in `complaints` collection
   - New Agent 2 logs in `agent_logs`

## 📊 View Your Data

### Firestore Console

Visit: `https://console.firebase.google.com/project/<YOUR_PROJECT_ID>/firestore`

You'll see:
- **complaints** collection with investigation grids
- **resolutions** collection with Agent 2 evaluations
- **agent_logs** collection with all agent activities
- **metadata** collection with complaint counter

### Cloud Logging

Visit: `https://console.cloud.google.com/logs`

Filter by:
- Resource: Cloud Run Service → `indigo-worker`
- Severity: All

## 🎯 Next Steps

1. **Monitor for a few days** to ensure stable operation
2. **Review agent logs** in Firestore to understand agent decisions
3. **Deploy the dashboard** (Next.js app) to visualize data
4. **Set up alerts** for errors or unusual patterns
5. **Implement backup policies** for Firestore

## ⚠️ Common Issues

### "Permission denied" errors
- Check IAM roles for the service account
- Ensure secrets have correct permissions

### "Firestore not found"
- Verify Firestore is initialized: `gcloud firestore databases list`
- Check region matches your configuration

### Worker not processing emails
- Verify Outlook folders exist with correct names
- Check Azure App permissions
- Review Cloud Run logs for errors

### Agent errors (429 Too Many Requests)
- Vertex AI quota exceeded
- Slow down polling interval temporarily
- Request quota increase in GCP Console

## 💡 Tips

1. **Start with low email volume** to test the system
2. **Monitor costs** using GCP Billing dashboard
3. **Use Cloud Monitoring** to create dashboards for key metrics
4. **Keep local code** as backup (already in `gcp-deployment/` directory)
5. **Document your GCP project ID** for future reference

## 🆘 Need Help?

- Check `gcp-deployment/README.md` for detailed documentation
- Review `gcp_migration_plan.md` for architecture details
- View Cloud Run logs: `gcloud run logs read indigo-worker`
- Check agent logs in Firestore `agent_logs` collection

---

**Estimated Total Time**: 30-40 minutes

**Monthly Cost**: ~$40-50 (see migration plan for breakdown)

**Status**: Your local code remains untouched in the main directory!
