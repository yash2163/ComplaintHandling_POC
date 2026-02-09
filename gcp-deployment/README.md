# GCP Deployment for Indigo Complaint Handling POC

This directory contains the GCP-specific code for deploying the complaint handling system to Google Cloud Platform.

## 📁 Directory Structure

```
gcp-deployment/
├── src/
│   ├── services/          # Core services
│   │   ├── agent1-classifier.ts       # Agent 1: Complaint Classifier (Vertex AI)
│   │   ├── agent2-evaluator.ts        # Agent 2: Resolution Evaluator (Vertex AI)
│   │   ├── firestore.ts               # Firestore database operations
│   │   └── outlook-gcp.ts             # Outlook integration (separated folders)
│   ├── workers/
│   │   └── complaint-worker.ts        # Main worker polling Outlook folders
│   ├── utils/
│   │   └── complaint-id.ts            # Complaint ID generation (CMP-YYYY-####)
│   └── types/
│       └── firestore-schema.ts        # Firestore schema definitions
├── Dockerfile                          # Container for worker service
├── package.json                        # Dependencies
├── tsconfig.json                       # TypeScript config
└── .env.example                        # Environment variables template
```

## 🏗️ Architecture

### Firestore Collections

1. **complaints** - Main complaint documents
   - Document ID: `CMP-YYYY-####` (e.g., CMP-2026-0001)
   - Contains investigation grid, status, metadata

2. **resolutions** - Resolution emails from Base Ops
   - Linked to complaints via `complaintId`
   - Contains Agent 2 evaluation results

3. **agent_logs** - Comprehensive agent activity logs  
   - All agent actions logged with timestamps
   - Input/output, execution time, success/failure

4. **metadata** - System metadata
   - Complaint ID counter for sequence generation

### Email Flow

```
Outlook Complaints Folder → Agent 1 → Firestore (complaints)
Outlook Resolutions Folder → Agent 2 → Firestore (resolutions + updates complaints)
```

## 🚀 Quick Start

### Prerequisites

1. GCP Project with billing enabled
2. Azure App Registration for Outlook access
3. gcloud CLI installed and authenticated

### 1. Set Up GCP Services

```bash
# Set your project ID
export GCP_PROJECT_ID=your-project-id
gcloud config set project $GCP_PROJECT_ID

# Enable required APIs
gcloud services enable \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com

# Initialize Firestore (choose region when prompted)
gcloud firestore databases create --region=us-central1
```

### 2. Create Secrets

```bash
# Store Azure credentials
echo -n "YOUR_AZURE_TENANT_ID" | gcloud secrets create azure-tenant --data-file=-
echo -n "YOUR_AZURE_CLIENT_ID" | gcloud secrets create azure-client --data-file=-
echo -n "YOUR_AZURE_CLIENT_SECRET" | gcloud secrets create azure-secret --data-file=-
echo -n "YOUR_EMAIL@example.com" | gcloud secrets create target-email --data-file=-

# Grant access to Cloud Run service account
PROJECT_NUMBER=$(gcloud projects describe $GCP_PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SECRET in azure-tenant azure-client azure-secret target-email; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"
done
```

### 3. Local Development

```bash
cd gcp-deployment

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env

# Run worker locally (connects to GCP Firestore)
npm run dev
```

### 4. Deploy to Cloud Run

```bash
# Create Artifact Registry repository
gcloud artifacts repositories create indigo-app \
  --repository-format=docker \
  --location=us-central1

# Configure Docker
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

## 📧 Outlook Setup

### Create Folders in Outlook

1. Log into Outlook with the target mailbox
2. Create two folders:
   - **Complaints** - For incoming customer complaints
   - **Resolutions** - For Base Ops team responses

The worker will automatically find/create these folders on first run.

### Email Format

**For Resolutions:**
Include the complaint ID in the subject or body:
- Subject: `Re: Complaint CMP-2026-0123`
- Body: `Regarding CMP-2026-0123...`

Agent 2 will extract the ID and match it to the original complaint.

## 🔍 Monitoring & Logs

### View Agent Logs in Firestore

The `agent_logs` collection contains detailed logs of all agent activities:

```typescript
// Query logs for a specific complaint
const logs = await firestoreService.getAgentLogs({
  complaintId: 'CMP-2026-0001',
  limit: 50
});

// Query logs by agent
const agent1Logs = await firestoreService.getAgentLogs({
  agentName: 'Agent 1',
  limit: 100
});
```

### View System Logs in Cloud Logging

```bash
# View worker logs
gcloud run logs read indigo-worker --region=us-central1 --limit=100

# Stream logs in real-time
gcloud run logs tail indigo-worker --region=us-central1
```

### Log Structure

Each agent log contains:
- **agentName**: "Agent 1" or "Agent 2"
- **agentAction**: Type of action performed
- **input**: Email details (subject, preview)
- **output**: Success/failure, data/error
- **executionTimeMs**: Performance metric
- **timestamp**: When it occurred
- **displayMessage**: Human-readable summary

## 💰 Cost Estimation

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Cloud Run (Worker) | 1 min instance, 512MB | ~$15 |
| Firestore | <10K reads/writes, <1GB storage | ~$1 |
| Vertex AI (Gemini) | ~1000 requests/day | ~$20-30 |
| Secret Manager | 4 secrets, 1K accesses | ~$0.50 |
| Cloud Logging | <5GB logs | ~$3 |
| **Total** | | **~$40-50/month** |

## 🔒 Security Best Practices

1. **Never commit `.env`** - Use `.env.example` as template
2. **Use Secret Manager** - All credentials in Secret Manager for production
3. **Minimal IAM** - Grant least privilege to service accounts
4. **VPC Service Controls** - Consider enabling for sensitive data
5. **Audit Logs** - Enable Cloud Audit Logs for compliance

## 🧪 Testing

### Test Complaint ID Generation

```bash
# Run TypeScript directly
npx ts-node -e "
import { ComplaintIdService } from './src/utils/complaint-id';
const service = new ComplaintIdService process.env.GCP_PROJECT_ID!);
service.generateComplaintId().then(id => console.log('Generated:', id));
"
```

### Test Agent 1 Locally

```bash
# Create test script
npx ts-node src/services/agent1-classifier.ts
```

## 📊 Dashboard Integration

The Next.js dashboard (separate deployment) will:
1. Read from Firestore collections in real-time
2. Display complaint status, investigation grids
3. Show agent activity logs in clean UI
4. Allow CX teams to view draft responses

## 🆘 Troubleshooting

### Worker not processing emails

1. Check Outlook connection:
   ```bash
   # View logs
   gcloud run logs read indigo-worker --limit=50
   ```

2. Verify Azure App permissions:
   - `Mail.Read` for reading emails
   - `Mail.ReadWrite` for marking as read

3. Check Firestore permissions:
   ```bash
   # Test Firestore connection
   gcloud firestore collections list
   ```

### Agent errors

1. Check Vertex AI quota:
   ```bash
   gcloud services quotas list --service=aiplatform.googleapis.com
   ```

2. Review agent logs in Firestore `agent_logs` collection

3. Check model availability:
   - `gemini-2.0-flash-exp` may have regional restrictions

## 📝 Next Steps

1. [ ] Review and deploy worker to Cloud Run
2. [ ] Create Outlook folders and test email ingestion
3. [ ] Deploy Next.js dashboard (separate guide)
4. [ ] Set up monitoring and alerts
5. [ ] Configure backup policies for Firestore

## 🔗 Related Documentation

- [GCP Migration Plan](../brain/.../gcp_migration_plan.md)
- [Local Development](../README.md)
- [API Documentation](./docs/API.md)

---

For questions or issues, refer to the main migration plan document.
