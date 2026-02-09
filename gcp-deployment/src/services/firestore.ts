import { Firestore, Timestamp } from '@google-cloud/firestore';
import {
    ComplaintDocument,
    ResolutionDocument,
    AgentLogDocument,
    COLLECTIONS
} from '../types/firestore-schema';

export class FirestoreService {
    private firestore: Firestore;

    constructor(projectId: string) {
        this.firestore = new Firestore({
            projectId,
            ignoreUndefinedProperties: true
        });
    }

    // ========== COMPLAINT OPERATIONS ==========

    async createComplaint(data: Omit<ComplaintDocument, 'createdAt' | 'updatedAt'>): Promise<void> {
        const complaintRef = this.firestore.collection(COLLECTIONS.COMPLAINTS).doc(data.id);

        await complaintRef.set({
            ...data,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
    }

    async getComplaint(complaintId: string): Promise<ComplaintDocument | null> {
        const complaintRef = this.firestore.collection(COLLECTIONS.COMPLAINTS).doc(complaintId);
        const doc = await complaintRef.get();

        return doc.exists ? (doc.data() as ComplaintDocument) : null;
    }

    async updateComplaintStatus(
        complaintId: string,
        status: ComplaintDocument['status'],
        resolutionStatus?: ComplaintDocument['resolutionStatus']
    ): Promise<void> {
        const complaintRef = this.firestore.collection(COLLECTIONS.COMPLAINTS).doc(complaintId);

        const updateData: any = {
            status,
            updatedAt: Timestamp.now()
        };

        if (resolutionStatus) {
            updateData.resolutionStatus = resolutionStatus;
        }

        if (status === 'RESOLVED') {
            updateData.resolvedAt = Timestamp.now();
        }

        await complaintRef.update(updateData);
    }

    async listComplaints(filters?: {
        status?: ComplaintDocument['status'];
        limit?: number;
    }): Promise<ComplaintDocument[]> {
        let query: any = this.firestore
            .collection(COLLECTIONS.COMPLAINTS)
            .orderBy('createdAt', 'desc');

        if (filters?.status) {
            query = query.where('status', '==', filters.status);
        }

        if (filters?.limit) {
            query = query.limit(filters.limit);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data() as ComplaintDocument);
    }

    // ========== RESOLUTION OPERATIONS ==========

    async createResolution(data: Omit<ResolutionDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const resolutionRef = this.firestore.collection(COLLECTIONS.RESOLUTIONS).doc();

        await resolutionRef.set({
            ...data,
            id: resolutionRef.id,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });

        return resolutionRef.id;
    }

    async getResolutionsByComplaint(complaintId: string): Promise<ResolutionDocument[]> {
        const snapshot = await this.firestore
            .collection(COLLECTIONS.RESOLUTIONS)
            .where('complaintId', '==', complaintId)
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map(doc => doc.data() as ResolutionDocument);
    }

    // ========== AGENT LOG OPERATIONS ==========

    async logAgentActivity(data: Omit<AgentLogDocument, 'id' | 'timestamp'>): Promise<void> {
        const logRef = this.firestore.collection(COLLECTIONS.AGENT_LOGS).doc();

        await logRef.set({
            ...data,
            id: logRef.id,
            timestamp: Timestamp.now()
        });
    }

    async getAgentLogs(filters?: {
        complaintId?: string;
        agentName?: AgentLogDocument['agentName'];
        limit?: number;
    }): Promise<AgentLogDocument[]> {
        let query: any = this.firestore
            .collection(COLLECTIONS.AGENT_LOGS)
            .orderBy('timestamp', 'desc');

        if (filters?.complaintId) {
            query = query.where('complaintId', '==', filters.complaintId);
        }

        if (filters?.agentName) {
            query = query.where('agentName', '==', filters.agentName);
        }

        if (filters?.limit) {
            query = query.limit(filters.limit);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data() as AgentLogDocument);
    }

    // ========== UTILITY OPERATIONS ==========

    async checkEmailProcessed(emailId: string): Promise<boolean> {
        // Check if email exists in complaints
        const complaintsSnapshot = await this.firestore
            .collection(COLLECTIONS.COMPLAINTS)
            .where('originalEmailId', '==', emailId)
            .limit(1)
            .get();

        if (!complaintsSnapshot.empty) return true;

        // Check if email exists in resolutions
        const resolutionsSnapshot = await this.firestore
            .collection(COLLECTIONS.RESOLUTIONS)
            .where('originalEmailId', '==', emailId)
            .limit(1)
            .get();

        return !resolutionsSnapshot.empty;
    }
}
