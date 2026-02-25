import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

async function run() {
    try {
        console.log("Fetching available models...");
        // In older SDK versions, there might not be a listModels directly exposed. We can check if it exists:
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`);
        const data = await response.json();

        const embeddingModels = data.models.filter((m: any) => m.supportedGenerationMethods.includes("embedContent"));
        console.log("Supported Embedding Models:");
        embeddingModels.forEach((m: any) => console.log(m.name, m.supportedGenerationMethods));
    } catch (e) {
        console.error(e);
    }
}
run();
