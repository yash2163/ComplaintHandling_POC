// Updated Outlook service for GCP deployment
// Reads from two separate folders: "Complaints" and "Resolutions"

import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import 'isomorphic-fetch';

export interface OutlookEmail {
    id: string;
    subject: string;
    body: string;
    from: {
        email: string;
        name: string;
    };
    receivedDateTime: Date;
    hasAttachments: boolean;
}

export class OutlookServiceGCP {
    private client: Client;
    private targetMailbox: string;

    constructor(
        tenantId: string,
        clientId: string,
        clientSecret: string,
        targetMailbox: string
    ) {
        const credential = new ClientSecretCredential(
            tenantId,
            clientId,
            clientSecret
        );

        this.client = Client.initWithMiddleware({
            authProvider: {
                getAccessToken: async () => {
                    const token = await credential.getToken([
                        'https://graph.microsoft.com/.default'
                    ]);
                    return token.token;
                }
            }
        });

        this.targetMailbox = targetMailbox;
    }

    /**
     * Get or create folder by name
     */
    private async getOrCreateFolder(folderName: string): Promise<string> {
        try {
            // Search for existing folder
            const folders = await this.client
                .api(`/users/${this.targetMailbox}/mailFolders`)
                .get();

            const existingFolder = folders.value.find(
                (f: any) => f.displayName === folderName
            );

            if (existingFolder) {
                return existingFolder.id;
            }

            // Create folder if not found
            const newFolder = await this.client
                .api(`/users/${this.targetMailbox}/mailFolders`)
                .post({
                    displayName: folderName
                });

            return newFolder.id;
        } catch (error) {
            console.error(`Error getting/creating folder ${folderName}:`, error);
            throw error;
        }
    }

    /**
     * Fetch unread emails from the Complaints folder
     */
    async fetchComplaintEmails(limit: number = 10): Promise<OutlookEmail[]> {
        try {
            const folderId = await this.getOrCreateFolder('Complaints');

            const messages = await this.client
                .api(`/users/${this.targetMailbox}/mailFolders/${folderId}/messages`)
                .filter('isRead eq false')
                .top(limit)
                .orderby('receivedDateTime desc')
                .select('id,subject,body,from,receivedDateTime,hasAttachments')
                .get();

            return messages.value.map((msg: any) => ({
                id: msg.id,
                subject: msg.subject || '(No Subject)',
                body: msg.body?.content || '',
                from: {
                    email: msg.from?.emailAddress?.address || '',
                    name: msg.from?.emailAddress?.name || ''
                },
                receivedDateTime: new Date(msg.receivedDateTime),
                hasAttachments: msg.hasAttachments || false
            }));
        } catch (error) {
            console.error('Error fetching complaint emails:', error);
            throw error;
        }
    }

    /**
     * Fetch unread emails from the Resolutions folder
     */
    async fetchResolutionEmails(limit: number = 10): Promise<OutlookEmail[]> {
        try {
            const folderId = await this.getOrCreateFolder('Resolutions');

            const messages = await this.client
                .api(`/users/${this.targetMailbox}/mailFolders/${folderId}/messages`)
                .filter('isRead eq false')
                .top(limit)
                .orderby('receivedDateTime desc')
                .select('id,subject,body,from,receivedDateTime,hasAttachments')
                .get();

            return messages.value.map((msg: any) => ({
                id: msg.id,
                subject: msg.subject || '(No Subject)',
                body: msg.body?.content || '',
                from: {
                    email: msg.from?.emailAddress?.address || '',
                    name: msg.from?.emailAddress?.name || ''
                },
                receivedDateTime: new Date(msg.receivedDateTime),
                hasAttachments: msg.hasAttachments || false
            }));
        } catch (error) {
            console.error('Error fetching resolution emails:', error);
            throw error;
        }
    }

    /**
     * Mark email as read
     */
    async markAsRead(emailId: string): Promise<void> {
        try {
            await this.client
                .api(`/users/${this.targetMailbox}/messages/${emailId}`)
                .patch({
                    isRead: true
                });
        } catch (error) {
            console.error(`Error marking email ${emailId} as read:`, error);
            throw error;
        }
    }

    /**
     * Test connection to Outlook
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.client.api(`/users/${this.targetMailbox}`).get();
            console.log('✅ Outlook connection successful');
            return true;
        } catch (error) {
            console.error('❌ Outlook connection failed:', error);
            return false;
        }
    }
}
