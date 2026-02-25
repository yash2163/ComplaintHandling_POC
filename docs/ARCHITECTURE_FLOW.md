# Indigo RAG Auto-Resolution POC Architecture

## Overview
This document outlines the architecture and execution flow for the Retrieval-Augmented Generation (RAG) Auto-Resolution system designed to process airline passenger complaints automatically. 

The system reads inbound emails from Microsoft Outlook, attempts to understand the complaint, matches it against past actions and an agent limits table, and then auto-drafts resolutions based on its findings.

## High-Level Architecture
The system consists of three main components:
1. **The Poller Worker (`src/worker.ts`)**: An automated background process that continuously checks the designated Microsoft 365 Inbox.
2. **The LLM + RAG Agent (`src/agent_api/llm_rag.ts`)**: The AI "brain" that uses Google Gemini Flash and ChromaDB to evaluate situations logically.
3. **The Data Layer**: 
    - **PostgreSQL**: Stores persistent tracking records (`Complaint`, `Passenger`, `Message`).
    - **ChromaDB**: In-memory / Docker-compose vector store for semantic search over past complaints.
    - **SQLite (`better-sqlite3`)**: Stores local flat files (`resolutions.db` and `master_table.db`) for easily editable AI bounds.

## End-to-End Execution Flow

### 1. Ingestion Phase 
1. `worker.ts` operates on an infinite polling loop (e.g., every 30 seconds).
2. It authenticates with Azure and calls the Microsoft Graph API using `OutlookService`.
3. It identifies unread emails in the specifically designated `Complaints` folder.
4. For every unread email, a new `Complaint` object is stored in PostgreSQL to track its lifecycle.

### 2. Contextual RAG Phase 
1. The raw email text and customer PNR data (if available) are passed to the `RAGAgent.processComplaintRAG()` function.
2. **Category Extraction**: Gemini explicitly classifies the complaint (e.g., "Delay", "Baggage", "Staff").
3. **Vector Similarity Search**: The agent queries **ChromaDB**. It transforms the new complaint into a vector map using `gemini-embedding-001` and retrieves the most geometrically similar *past* complaints.
4. **Context Gathering**: It looks up how those past similar cases were handled in `resolutions.db` (e.g., whether the outcome was 'Good' and should be emulated, or 'Bad' and should be avoided).

### 3. Decision Phase
1. A carefully engineered prompt binds the user's current complaint, the passenger PNR details, and the retrieved past similar cases.
2. Gemini evaluates the constraints and outputs a structured JSON response containing:
   - A distinct "Action" (e.g., "Refund").
   - A distinct "Outcome" (e.g., "25% refund").
   - A fully written, professional draft email addressing the customer's issues.
   - Theoretical reasoning explaining why it chose this value based on the ingested past history.

### 4. Validation (Master Limits Check) Phase
1. Even though Gemini proposes a percentage or action, the pipeline must strictly validate that the AI is not acting outside operational limits.
2. `database.ts` automatically parses the AI's proposal and checks the local SQLite `master_table.db` (e.g., "refund" limits).
3. If the mathematical value proposed by the AI is within the bounded limits table, the complaint is marked as `Eligible`.

### 5. Resolution & Drafting Phase
1. If the proposal is strictly **Eligible**:
    - The worker sets the `Complaint` status to `RESOLVED`.
    - It uses the `OutlookService` to create a Draft email in the `Drafts` folder of the target mailbox (using `ragResult.draft_response`).
    - The original complaint email is flagged as "Processed" or marked visually on Outlook.
2. If the proposal is **Ineligible** (e.g., the AI suggested a 50% refund, but the DB limit is 30%):
    - The status is escalated to `WAITING_OPS` for an internal human team to manually review.
