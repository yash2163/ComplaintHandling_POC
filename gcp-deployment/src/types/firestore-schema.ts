// Firestore Schema Definitions for GCP Deployment
// This file defines the Firestore collections and document structures

export interface ComplaintDocument {
    // Document ID: CMP-{YEAR}-{SEQUENCE} (e.g., CMP-2026-0001)
    id: string;

    // Email metadata
    originalEmailId: string; // Microsoft Graph message ID
    subject: string;
    senderEmail: string;
    senderName: string;
    receivedAt: Date;

    // Investigation Grid (from Agent 1)
    investigationGrid: {
        passenger_name: string | null;
        pnr: string | null;
        flight_number: string | null;
        flight_date: string | null;
        route: string | null;
        issue_category: string | null;
        issue_summary: string | null;
        requested_resolution: string | null;
        urgency_level: 'low' | 'medium' | 'high' | null;
        origin_station: string | null;
    };

    // Status tracking
    status: 'NEW' | 'WAITING_OPS' | 'PROCESSING' | 'DRAFT_READY' | 'APPROVED' | 'RESOLVED';
    resolutionStatus: 'PENDING' | 'RESOLVED' | 'FLAGGED';

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
    resolvedAt?: Date;
}

export interface ResolutionDocument {
    // Document ID: auto-generated
    id: string;

    // Link to complaint
    complaintId: string; // References the CMP-YYYY-#### ID

    // Email metadata
    originalEmailId: string; // Microsoft Graph message ID
    subject: string;
    senderEmail: string;
    senderName: string;
    receivedAt: Date;

    // Resolution content
    resolutionText: string;
    crewNotes?: string;

    // Agent 2 evaluation
    evaluation: {
        status: 'RESOLVED' | 'FLAGGED';
        reasoning: string;
        summary: string;
        confidence: number;
    };

    // Draft response (if resolved) 
    draftResponse?: string;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

export interface AgentLogDocument {
    // Document ID: auto-generated
    id: string;

    // Agent information
    agentName: 'Agent 1' | 'Agent 2';
    agentAction: string; // e.g., 'extract_grid', 'evaluate_resolution'

    // Reference
    complaintId?: string;
    resolutionId?: string;

    // Execution details
    input: {
        emailId: string;
        subject: string;
        bodyPreview: string; // First 200 chars
    };

    output: {
        success: boolean;
        data?: any;
        error?: string;
    };

    // Performance metrics
    executionTimeMs: number;
    tokensUsed?: number;
    modelUsed: string;

    // Timestamp
    timestamp: Date;

    // Human-readable summary for dashboard
    displayMessage: string; // e.g., "Agent 1 extracted grid for complaint CMP-2026-0123"
}

// Collection names
export const COLLECTIONS = {
    COMPLAINTS: 'complaints',
    RESOLUTIONS: 'resolutions',
    AGENT_LOGS: 'agent_logs',
    METADATA: 'metadata' // For storing sequence counters
} as const;

// Metadata document for complaint ID generation
export interface MetadataDocument {
    id: 'complaint_counter';
    currentYear: number;
    currentSequence: number;
    lastUpdated: Date;
}
