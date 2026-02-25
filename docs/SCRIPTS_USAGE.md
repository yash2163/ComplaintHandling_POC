# Indigo POC Utility Scripts

This project includes a pristine `src/scripts` directory containing explicit tools designed to manipulate data or force specific test conditions safely outside of the primary worker loop.

## Core Scripts Inventory

### 1. DB Manager (`db_manager.ts`)
This is the single most important utility for interacting with the AI's operational rules. It allows you to manipulate the local SQLite constraints (`master_table.db`) and the semantic ChromaDB vector representations (`resolutions.db`).

**Command Usage:**
```bash
# Initialize brand new blank databases (Creates local files)
npx ts-node src/scripts/db_manager.ts init

# SEED the databases explicitly with Mock Data 
# (This acts as the brain for the RAG agent comparing past actions)
npx ts-node src/scripts/db_manager.ts seed

# VIEW the existing allowed permission limit values for the AI
npx ts-node src/scripts/db_manager.ts view limits

# VIEW the physical past resolutions stored in SQLite 
npx ts-node src/scripts/db_manager.ts view resolutions

# ADD a brand new agent limit override
npx ts-node src/scripts/db_manager.ts add-limit <type> <%> "<desc>"
# Example: npx ts-node src/scripts/db_manager.ts add-limit refund 20 "Capped auto refund"
```

### 2. Simulate Ingestion (`simulate_ingestion.ts`)
When testing the POC, you do not want to constantly open Outlook in your browser to send test complaint emails to yourself. Use this script to inject one instantly over Microsoft Graph.

**Command Usage:**
```bash
npx ts-node src/scripts/simulate_ingestion.ts
```
*Note: This will forcefully draft and save a test email into the 'Complaints' folder of the configured `TARGET_MAILBOX_EMAIL`. If `npm run start:worker` is running, it will be instantly detected!*

### 3. Clear Database (`clear_database.ts`)
If you test heavily, your Postgres database will clutter with resolved mock complaints. Run this to drop all Postgres tabular data related to complaints and start entirely fresh.

**Command Usage:**
```bash
npx ts-node src/scripts/clear_database.ts
```

### 4. Validate Connectivity (`validate_connectivity.ts`)
If your worker fails to start, it is usually an Outlook API credential expiration. Run this explicit verifier. It will attempt to authenticate and cleanly log exactly which Azure or Graph API edge is failing without booting the heavy `worker.ts` architecture.

**Command Usage:**
```bash
npm run validate-connectivity
# Alternatively:
npx ts-node src/scripts/validate_connectivity.ts
```

## Secondary Test Scripts
There are scripts specifically designed to test the RAG flow and add explicit data outside of the database manager:

### Custom Case Ingestion (`add_custom_case.ts`)
If you want to inject a very specific past complaint and resolution straight into the AI's Vector "brain" so it knows how to handle a future case:
1. Open `src/scripts/add_custom_case.ts` in your editor.
2. Edit the variables at the top (`CUSTOM_COMPLAINT`, `ACTION_TAKEN`, etc.).
3. Run the script:
```bash
npx ts-node src/scripts/add_custom_case.ts
```
*Note: This script automatically adds the data to SQLite AND immediately vectorizes it into ChromaDB behind the scenes for you.*

### RAG Tester (`test_rag.ts`)
Test the exact mathematical flow of the Vector DB and Gemini without needing to push emails or start a worker.
```bash
npx ts-node src/test_rag.ts 
```
*It displays the exact text pulled from ChromaDB alongside the explicit JSON reasoning object returned by Gemini. Perfect for showcasing the RAG logic during a presentation securely!*
