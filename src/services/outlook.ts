import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import dotenv from 'dotenv';
import 'isomorphic-fetch';

dotenv.config();

export class OutlookService {
    private client: Client | null = null;
    private credential: ClientSecretCredential | null = null;

    constructor() {
        this.validateEnv();
    }

    private validateEnv() {
        const required = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'];
        const missing = required.filter(key => !process.env[key]);
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
    }

    public async authenticate(): Promise<boolean> {
        try {
            this.credential = new ClientSecretCredential(
                process.env.AZURE_TENANT_ID!,
                process.env.AZURE_CLIENT_ID!,
                process.env.AZURE_CLIENT_SECRET!
            );

            const authProvider = new TokenCredentialAuthenticationProvider(this.credential, {
                scopes: ['https://graph.microsoft.com/.default']
            });

            this.client = Client.initWithMiddleware({
                authProvider: authProvider
            });

            // Simple call to verify token
            // We'll verify by fetching the user or organization details, 
            // but client-credentials flow often accesses /users/{id} or /me depending on permissions.
            // For POC with application permissions (Mail.Read), we check if we can get the client object ready.
            // But real validation happens on the first call.
            return true;
        } catch (error) {
            console.error('Authentication Initialization Failed:', error);
            return false;
        }
    }

    public async getMailboxMetadata(targetEmail: string): Promise<any> {
        if (!this.client) throw new Error('Client not initialized');

        try {
            // Just fetching the user profile to confirm existence and access
            const user = await this.client.api(`/users/${targetEmail}`).select('id,displayName,mail').get();
            return user;
        } catch (error) {
            console.error(`Failed to fetch metadata for ${targetEmail}:`, error);
            throw error;
        }
    }

    public async getRecentEmails(targetEmail: string, count: number = 5): Promise<any[]> {
        if (!this.client) throw new Error('Client not initialized');

        try {
            const messages = await this.client.api(`/users/${targetEmail}/messages`)
                .top(count)
                .select('id,subject,from,receivedDateTime,bodyPreview')
                .orderby('receivedDateTime DESC')
                .get();

            return messages.value;
        } catch (error) {
            console.error(`Failed to fetch emails for ${targetEmail}:`, error);
            throw error;
        }
    }
}
