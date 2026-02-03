import { IngestionService } from '../services/ingestion';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    const targetEmail = process.env.TARGET_MAILBOX_EMAIL;
    if (!targetEmail) {
        console.error('TARGET_MAILBOX_EMAIL not set');
        process.exit(1);
    }

    const ingestion = new IngestionService();

    try {
        await ingestion.init();
        await ingestion.processCycle(targetEmail);
    } catch (error) {
        console.error('Ingestion failed:', error);
        process.exit(1);
    }
}

run();
