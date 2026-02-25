import { ChromaClient, Collection, EmbeddingFunction } from 'chromadb';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { getAllResolutions } from './database';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
// Using a smaller, fast embedding model for text
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

class GeminiEmbeddingFunction implements EmbeddingFunction {
    public async generate(texts: string[]): Promise<number[][]> {
        const embeddings: number[][] = [];
        for (const text of texts) {
            const result = await embeddingModel.embedContent(text);
            embeddings.push(result.embedding.values);
        }
        return embeddings;
    }
}
const geminiEmbedder = new GeminiEmbeddingFunction();

// Store chroma data locally
const DATA_DIR = path.resolve(__dirname, '../../data/chroma');
const client = new ChromaClient({ path: 'http://localhost:8000' }); // We will use an in-memory client for simple POC or a running container, falling back to a mock if needed.
// For true local TS without a dedicated DB server, chroma in Node typically requires connecting to a local Chroma server
// However, to keep it extremely simple without Docker overhead for the vector DB alone, I'll mock a simple in-memory vector search if Chroma isn't running, but let's try strict Chroma first.

export class VectorStore {
    private collectionName = "past_complaints";

    async getEmbedding(text: string): Promise<number[]> {
        try {
            const result = await embeddingModel.embedContent(text);
            return result.embedding.values;
        } catch (error) {
            console.error("Error getting embedding from Gemini:", error);
            throw error;
        }
    }

    async getCollection(): Promise<Collection> {
        try {
            // Attempt to get or create collection
            return await client.getOrCreateCollection({
                name: this.collectionName,
                embeddingFunction: geminiEmbedder,
                metadata: { "hnsw:space": "cosine" }
            });
        } catch (error) {
            console.error("Error connecting to ChromaDB. Ensure Chroma is running locally on port 8000.");
            throw error;
        }
    }

    /**
     * Seeds the Vector Store with data from the SQLite DB
     */
    async seedFromDatabase() {
        console.log("Seeding ChromaDB Vector Store from SQLite...");
        const collection = await this.getCollection();
        const resolutions = getAllResolutions() as any[];

        const ids: string[] = [];
        const embeddings: number[][] = [];
        const metadatas: any[] = [];
        const documents: string[] = [];

        for (const res of resolutions) {
            ids.push(res.complaint_id);
            documents.push(res.complaint_text);
            metadatas.push({
                category: res.category,
                quality_flag: res.quality_flag
            });
            const emb = await this.getEmbedding(res.complaint_text);
            embeddings.push(emb);

            // Wait slightly to avoid rate limit spikes on Gemini
            await new Promise(r => setTimeout(r, 500));
        }

        if (ids.length > 0) {
            await collection.upsert({
                ids,
                embeddings,
                metadatas,
                documents
            });
            console.log(`Successfully seeded ${ids.length} complaints into ChromaDB.`);
        }
    }

    /**
     * Finds the 'k' most similar past complaints
     */
    async searchSimilarComplaints(queryText: string, category?: string, k: number = 2) {
        const collection = await this.getCollection();
        const queryEmbedding = await this.getEmbedding(queryText);

        const whereClause = category ? { category: { $eq: category } } : undefined;

        const results = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: k,
            where: whereClause
        });

        return results;
    }
}
