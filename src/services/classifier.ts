import { NormalizedEmail, EmailType } from '../types/domain';

export class ClassifierService {

    public classify(email: NormalizedEmail): EmailType {
        const subject = email.subject.toLowerCase();
        const body = email.body.toLowerCase();

        // 1. Base Ops Response Rule
        // Usually contains "RE:" and certain keywords, or from specific internal domain
        // For POC, we'll use simple keywords
        if (subject.includes('cx_complaint') || body.includes('complaint')) {
            return EmailType.CX_COMPLAINT;
        }

        if (subject.includes('base ops') || body.includes('operational update') || subject.includes('flight data')) {
            return EmailType.BASE_OPS_RESPONSE;
        }

        // Default to CX Complaint if it looks like a travel issue? 
        // For safety in POC, strict rules or IGNORE.
        // Let's add common travel complaint keywords
        const complaintKeywords = ['delay', 'cancelled', 'refund', 'rude', 'baggage', 'lost'];
        if (complaintKeywords.some(k => subject.includes(k) || body.includes(k))) {
            return EmailType.CX_COMPLAINT;
        }

        return EmailType.IGNORE;
    }
}
