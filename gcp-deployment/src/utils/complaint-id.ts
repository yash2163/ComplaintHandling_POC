import { Firestore } from '@google-cloud/firestore';
import {
    ComplaintDocument,
    COLLECTIONS,
    MetadataDocument
} from '../types/firestore-schema';

export class ComplaintIdService {
    private firestore: Firestore;

    constructor(projectId: string) {
        this.firestore = new Firestore({
            projectId,
            ignoreUndefinedProperties: true
        });
    }

    /**
     * Generates a new complaint ID in format: CMP-YYYY-####
     * Uses Firestore transaction to ensure uniqueness
     */
    async generateComplaintId(): Promise<string> {
        const metadataRef = this.firestore
            .collection(COLLECTIONS.METADATA)
            .doc('complaint_counter');

        try {
            const newId = await this.firestore.runTransaction(async (transaction) => {
                const metadataDoc = await transaction.get(metadataRef);
                const currentYear = new Date().getFullYear();

                let sequence = 1;

                if (metadataDoc.exists) {
                    const metadata = metadataDoc.data() as MetadataDocument;

                    // Reset sequence if year changed
                    if (metadata.currentYear !== currentYear) {
                        sequence = 1;
                    } else {
                        sequence = metadata.currentSequence + 1;
                    }
                }

                // Update metadata
                transaction.set(metadataRef, {
                    currentYear,
                    currentSequence: sequence,
                    lastUpdated: new Date()
                });

                // Format: CMP-2026-0001
                const paddedSequence = sequence.toString().padStart(4, '0');
                return `CMP-${currentYear}-${paddedSequence}`;
            });

            return newId;
        } catch (error) {
            console.error('Error generating complaint ID:', error);
            throw new Error('Failed to generate complaint ID');
        }
    }

    /**
     * Extracts complaint ID from email subject or body
     * Looks for pattern: CMP-YYYY-####
     */
    extractComplaintId(text: string): string | null {
        const pattern = /CMP-\d{4}-\d{4}/;
        const match = text.match(pattern);
        return match ? match[0] : null;
    }

    /**
     * Validates complaint ID format
     */
    isValidComplaintId(id: string): boolean {
        const pattern = /^CMP-\d{4}-\d{4}$/;
        return pattern.test(id);
    }
}
