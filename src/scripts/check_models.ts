import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

    try {
        // There is no direct listModels on the instance in this SDK version structure easily accessible?
        // Actually there is, but let's try a simple model check by running a known one.
        // Or use the model manager if exposed.
        // Wait, SDK documentation says we can use `getGenerativeModel` but listing needs `genAI.getGenerativeModel`? No.
        // Let's try raw fetch if SDK doesn't expose it easily, or just try 'gemini-pro'.

        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent('Hello');
        console.log('gemini-pro is working:', result.response.text());

    } catch (e: any) {
        console.error('Error with gemini-pro:', e.message);
    }
}

listModels();
