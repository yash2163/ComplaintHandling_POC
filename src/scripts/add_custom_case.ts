/**
 * PURPOSE: Easily add a custom past complaint and its resolution to the Vector Database.
 * USAGE: Edit the variables below, then run `npx ts-node src/scripts/add_custom_case.ts`
 * WHEN TO USE: Use this to test if the AI RAG system can accurately retrieve a specific past case you just invented.
 */
import { getResolutionsDb } from '../agent_api/database';
import { VectorStore } from '../agent_api/vector_store';
import crypto from 'crypto';

// ==========================================
// EDIT THESE VARIABLES TO ADD YOUR Custom CASE
// ==========================================
const CUSTOM_COMPLAINT = "My Indigo flight was diverted to another city due to bad weather, and we were left at the airport for 12 hours without hotel accommodation. I demand compensation.";
const CATEGORY = "Delay";          // e.g., "Delay", "Baggage", "Staff", "Other"
const ACTION_TAKEN = "Voucher";    // e.g., "Refund", "Voucher", "Apology"
const OUTCOME = "Provided a $150 hotel voucher and meal compensation.";
const QUALITY = "Good";            // "Good" (AI should copy this) or "Bad" (AI should avoid this)
// ==========================================

async function addCustomCase() {
    console.log(`Adding custom case to SQLite and Vector Store...`);
    const id = `C-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // 1. Add to SQLite
    const db = getResolutionsDb();
    db.prepare(`
        INSERT INTO resolutions (complaint_id, category, complaint_text, action_taken, outcome, quality_flag) 
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, CATEGORY, CUSTOM_COMPLAINT, ACTION_TAKEN, OUTCOME, QUALITY);
    db.close();
    console.log(`[SQLite] Added Resolution ID: ${id}`);

    // 2. Add to Vector DB (ChromaDB)
    try {
        const vs = new VectorStore();
        const collection = await vs.getCollection();
        const embedding = await vs.getEmbedding(CUSTOM_COMPLAINT);

        await collection.add({
            ids: [id],
            embeddings: [embedding],
            metadatas: [{ category: CATEGORY, quality_flag: QUALITY }],
            documents: [CUSTOM_COMPLAINT]
        });
        console.log(`[ChromaDB] Successfully vectorized and stored Complaint ${id}!`);
    } catch (error) {
        console.error("Failed to add to Vector Store. Is ChromaDB running on port 8000?", error);
    }
}

addCustomCase();
