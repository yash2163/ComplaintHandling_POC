export enum EmailType {
    CX_COMPLAINT = 'CX_COMPLAINT',
    BASE_OPS_RESPONSE = 'BASE_OPS_RESPONSE',
    IGNORE = 'IGNORE'
}

export interface NormalizedEmail {
    id: string;
    sourceId: string; // Outlook ID
    subject: string;
    sender: {
        email: string;
        name: string | null;
    };
    recipients: string[];
    body: string; // Plain text
    receivedAt: Date;
    hasAttachments: boolean;
    classification?: EmailType;
    metadata?: any;
}

export interface InvestigationGrid {
    flight_number: string | null;
    date: string | null;
    issue_type: string | null;
    weather_condition: string | null;
    origin_station: string | null;
    pnr: string | null;
    complaint: string | null;
    customer_name: string | null;
    seat_number: string | null;
    source: string | null;
    destination: string | null;
}

export interface CaseFile {
    caseId: string;
    originalEmailId: string;
    rawEmail: NormalizedEmail;
    grid: InvestigationGrid;
    status: 'NEW' | 'PROCESSING' | 'WAITING_OPS' | 'READY_FOR_REVIEW' | 'CLOSED';
    createdAt: Date;
    updatedAt: Date;
}
