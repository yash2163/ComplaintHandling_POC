# Testing the RAG AI with Custom Cases

This guide explains how to showcase and test the RAG Auto-Resolution logic by injecting custom "past" cases directly into the AI's Vector brain, and then simulating a matching incoming email to watch the AI resolve it automatically.

## The Testing Flow Overview

To prove the AI actually "learns" from past resolutions and mathematically applies operational limits, we perform a 3-step showcase:
1. **Inject Memory:** Add a specific invented past complaint and an ideal resolution directly into the Vector DB.
2. **Start the Engine:** Run the primary worker so it is actively monitoring for new emails.
3. **Simulate a Customer:** Inject a new, slightly differently worded complaint email into the Outlook inbox.

---

### Step 1: Add a Fake Resolution to the AI's Brain
Use our custom ingestion script to build a highly specific memory for the AI.

1. Open `src/scripts/add_custom_case.ts` in your code editor.
2. At the very top of the file, locate the `EDIT THESE VARIABLES` block.
3. Invent your custom scenario and the exact operational outcome you want the AI to emulate in the future:
   ```typescript
   const CUSTOM_COMPLAINT = "My Indigo flight was diverted to another city due to bad weather, and we were left at the airport for 12 hours without hotel accommodation. I demand compensation.";
   const CATEGORY = "Delay";          
   const ACTION_TAKEN = "Voucher";    
   const OUTCOME = "Provided a $150 hotel voucher and meal compensation.";
   const QUALITY = "Good";  // VERY IMPORTANT: Tell the AI this is a "Good" example to mimic.
   ```
4. Run the injection script:
   ```bash
   npx ts-node src/scripts/add_custom_case.ts
   ```
   *Note: This script automatically adds the tabular data to SQLite AND immediately converts your text to a mathematical embedding array using Gemini, storing it instantly in the ChromaDB Vector cluster!*

---

### Step 2: Ensure the Worker is Running
The primary `worker.ts` process must be running in the background to automatically catch the simulated email we are about to send.

Open a terminal dedicated strictly to the worker and run:
```bash
npm run start:worker
```
Wait to see `Worker started... Polling cycle start...` before proceeding to Step 3.

---

### Step 3: Trigger a Fake Email from the Customer
Now we act as a customer sending an email that is semantically similar (but not identical) to the memory we injected in Step 1.

1. Open `src/scripts/simulate_ingestion.ts` in your editor.
2. Locate the `EDIT THESE VARIABLES TO TEST A NEW COMPLAINT` block.
3. Paste a complaint that demands resolution. For example, word the diverted flight scenario slightly differently:
   ```typescript
   const subject = "Urgent: Diverted Flight Chaos";
   const body = `
   Hi Indigo Team,
   
   My flight was diverted to another city last night due to bad weather. 
   We were left sitting at the airport for 12 hours without any hotel accommodation offered.
   
   This is unacceptable. I demand compensation for my hotel and meals.
   
   Regards,
   Test Passenger
   `;
   ```
4. Run the simulation script to instantly drop this into the Microsoft Graph `Complaints` folder:
   ```bash
   npx ts-node src/scripts/simulate_ingestion.ts
   ```

### Step 4: Watch the Magic Happen!
Switch back to the terminal running the worker. Within 10 to 30 seconds, you will see the following sequence occur automatically:

1. **Detection:** The worker logs `New Email found in Complaints...`
2. **Context Retrieval:** The worker will output a massive log block titled `=== Retrieved Context from Vector DB ===`. You will physically see the AI successfully dig up the exact `add_custom_case.ts` memory you injected in Step 1!
3. **Drafting:** The worker logs `RAG Decision: Eligible=true, Action=Voucher ... `.
4. **Conclusion:** Open your actual Outlook Web App, navigate to the `TARGET_MAILBOX_EMAIL`, and look in the **Drafts** folder. A brand new, highly empathetic email drafted by Gemini authorizing the exact outcome you taught it will be sitting there waiting for approval!
