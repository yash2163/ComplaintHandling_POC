# GCP API Requirements for Indigo Complaint Handling System

**Project:** `indigoifs`  
**Requested by:** Yash Rajput (yash.rajput@minfytech.com)  
**Date:** February 6, 2026  
**Purpose:** Deploy AI-powered complaint handling system on GCP

---

## 📋 Required APIs

The following Google Cloud APIs need to be enabled for the Indigo Complaint Handling POC:

### 1. **Vertex AI API** (`aiplatform.googleapis.com`)

**Purpose:** AI Agent Development Kit (ADK) and Gemini model access

**Used For:**
- **Agent 1 (Complaint Classifier):** Analyzes incoming complaint emails and extracts structured information (passenger name, PNR, flight details, issue category, etc.)
- **Agent 2 (Resolution Evaluator):** Evaluates Base Ops team responses to determine if complaints are resolved or need escalation
- Powers natural language processing for email classification and content extraction

**Why This API:**
- Native GCP integration with Gemini 2.0 models
- Better performance and reliability than direct API calls
- Integrated monitoring and logging
- Cost-effective for our use case (~$20-30/month based on 1000 requests/day)

**Technical Usage:**
```typescript
// Agent 1 uses Vertex AI to extract complaint details
const agent1 = new Agent1ComplaintClassifier(projectId);
const { grid, confidence } = await agent1.extractInvestigationGrid(email);
```

---

### 2. **Cloud Firestore API** (`firestore.googleapis.com`)

**Purpose:** NoSQL document database for storing complaints, resolutions, and agent activity logs

**Used For:**
- **Complaints Collection:** Stores investigation grids with unique IDs (CMP-2026-####)
- **Resolutions Collection:** Stores Base Ops responses and Agent 2 evaluations
- **Agent Logs Collection:** Comprehensive audit trail of all AI agent actions
- **Metadata Collection:** Maintains complaint ID sequence counter

**Why This API:**
- Separate collections for complaints and resolutions (as requested)
- Real-time data synchronization for dashboard
- Scalable and serverless (no database management overhead)
- Cost-effective: ~$1/month for expected volume (<10K reads/writes per day)
- Better suited for document-based data than Cloud SQL

**Data Structure:**
```
firestore/
├── complaints/CMP-2026-0001    # Complaint documents
├── resolutions/abc123          # Resolution documents
├── agent_logs/log001           # Agent activity logs
└── metadata/complaint_counter  # ID generation
```

---

### 3. **Secret Manager API** (`secretmanager.googleapis.com`)

**Purpose:** Secure storage and access control for sensitive credentials

**Used For:**
- **Azure AD Credentials:** Tenant ID, Client ID, Client Secret for Outlook integration
- **Target Mailbox Email:** Email address for complaint/resolution folders
- **Future Secrets:** Any additional API keys or credentials

**Why This API:**
- Industry best practice for credential management
- Prevents hardcoding secrets in code or environment variables
- Automatic encryption at rest and in transit
- Audit logging for all secret access
- IAM-based access control
- Cost: ~$0.50/month (4 secrets × 1000 accesses)

**Security Benefits:**
- No credentials in source code
- No `.env` files in production
- Automatic rotation support
- Compliance with security standards

---

### 4. **Cloud Run API** (`run.googleapis.com`)

**Purpose:** Serverless container deployment platform

**Used For:**
- **Worker Service:** Continuously running service that polls Outlook folders every 60 seconds
- **Dashboard (Future):** Web UI for CX and Base Ops teams to view complaint status
- Processes complaint emails with Agent 1
- Processes resolution emails with Agent 2

**Why This API:**
- Serverless: No server management required
- Auto-scaling: Scales from 1 to 3 instances based on load
- Cost-effective: Pay only for actual usage (~$15/month for continuous worker)
- Built-in HTTPS, logging, and monitoring
- Easier deployment than managing VMs or GKE

**Deployment Configuration:**
- Min instances: 1 (always warm for 60-second polling)
- Max instances: 3 (auto-scale if needed)
- Memory: 512Mi
- CPU: 1

---

### 5. **Artifact Registry API** (`artifactregistry.googleapis.com`)

**Purpose:** Docker container image registry

**Used For:**
- Storing Docker images for the worker service
- Version control of container images
- Secure image distribution to Cloud Run

**Why This API:**
- Native integration with Cloud Run
- More secure than public Docker Hub
- Better performance (hosted in same region)
- Automatic vulnerability scanning
- Cost: ~$0.50/month (<5GB storage for 1-2 images)

**Container Images:**
- `us-central1-docker.pkg.dev/indigoifs/indigo-app/worker:latest` - Main worker service
- Future: Dashboard container image

---

## 🚀 How to Enable APIs

### Option 1: Via gcloud CLI (Recommended)

```bash
gcloud services enable \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  --project=indigoifs
```

### Option 2: Via Cloud Console

1. Visit: https://console.cloud.google.com/apis/dashboard?project=indigoifs
2. Click "+ ENABLE APIS AND SERVICES"
3. Search and enable each API:
   - Vertex AI API
   - Cloud Firestore API
   - Secret Manager API
   - Cloud Run API
   - Artifact Registry API

---

## 🔐 Required IAM Permissions (Optional)

If you'd like Yash to manage the deployment independently, grant the following role:

```bash
gcloud projects add-iam-policy-binding indigoifs \
  --member="user:yash.rajput@minfytech.com" \
  --role="roles/editor"
```

**Or** grant more specific roles:
- `roles/firestore.admin` - Manage Firestore database
- `roles/run.admin` - Deploy Cloud Run services
- `roles/secretmanager.admin` - Manage secrets
- `roles/artifactregistry.admin` - Push Docker images
- `roles/aiplatform.user` - Use Vertex AI

---

## 💰 Cost Estimate

| Service | Monthly Cost | Notes |
|---------|--------------|-------|
| Vertex AI (Gemini) | ~$20-30 | Based on 1000 requests/day |
| Firestore | ~$1 | <10K operations, <1GB storage |
| Cloud Run | ~$15 | 1 min instance, 512MB |
| Secret Manager | ~$0.50 | 4 secrets, 1K accesses |
| Artifact Registry | ~$0.50 | 1-2 container images |
| Cloud Logging | ~$3 | <5GB logs per month |
| **Total** | **~$40-50/month** | |

**Note:** These are estimates. Actual costs may be lower during testing/development phase.

---

## 📊 Architecture Overview

```
Outlook (Complaints & Resolutions Folders)
    ↓
Cloud Run Worker Service (Polls every 60s)
    ↓
Vertex AI Agents (Agent 1 & Agent 2)
    ↓
Firestore (Store complaints, resolutions, logs)
    ↓
Dashboard (Future - View complaint status)
```

**Data Flow:**
1. Customer sends complaint → Complaints folder
2. Worker polls folder → Agent 1 classifies and extracts data
3. Complaint stored in Firestore with ID: CMP-2026-####
4. Base Ops responds → Resolutions folder
5. Worker polls folder → Agent 2 evaluates resolution
6. Resolution stored, complaint status updated
7. All actions logged in Firestore for audit trail

---

## ✅ Next Steps After API Enablement

Once APIs are enabled, we will:

1. **Initialize Firestore database** (choose region: us-central1)
2. **Create Secret Manager secrets** (store Azure credentials)
3. **Build and deploy worker service** to Cloud Run
4. **Test with real emails** in Outlook folders
5. **Monitor logs and performance**

---

## 📞 Contact

For questions about this request, please contact:

**Yash Rajput**  
Email: yash.rajput@minfytech.com  
Purpose: Complaint Handling System POC

---

## 📚 Additional Documentation

- Full Migration Plan: `gcp-deployment/gcp_migration_plan.md`
- Quick Start Guide: `gcp-deployment/QUICKSTART.md`
- Technical Documentation: `gcp-deployment/README.md`

---

**Status:** ⏳ Awaiting API Enablement  
**Priority:** Medium  
**Estimated Setup Time:** 30 minutes after API enablement
