import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import dotenv from 'dotenv';
import 'isomorphic-fetch';

dotenv.config();

const TARGET_EMAIL = 'CRINDIGO@minfytech.com';

async function verifyMailbox() {
    console.log(`🔍 Verifying access for: ${TARGET_EMAIL}`);

    // 1. Authenticate (Copying logic from OutlookService to avoid modifying it)
    const credential = new ClientSecretCredential(
        process.env.AZURE_TENANT_ID!,
        process.env.AZURE_CLIENT_ID!,
        process.env.AZURE_CLIENT_SECRET!
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: ['https://graph.microsoft.com/.default']
    });

    const client = Client.initWithMiddleware({
        authProvider: authProvider
    });

    try {
        // 2. Check Metadata (User existence)
        console.log('\n1️⃣ Checking User Metadata...');
        const user = await client.api(`/users/${TARGET_EMAIL}`).select('id,displayName,mail').get();
        console.log(`   ✅ User Found: ${user.displayName} (${user.mail})`);
        console.log(`   🆔 ID: ${user.id}`);

        // 3. List Inbox Messages (Read Access)
        console.log('\n2️⃣ Checking Inbox Access (Read)...');
        const messages = await client.api(`/users/${TARGET_EMAIL}/messages`)
            .top(5)
            .select('subject,from,receivedDateTime')
            .get();
        console.log(`   ✅ Access Successful! Found ${messages.value.length} messages.`);
        messages.value.forEach((m: any) => {
            console.log(`      - [${m.receivedDateTime}] ${m.subject} (From: ${m.from?.emailAddress?.address})`);
        });

        // 4. Create Draft (Write Access)
        console.log('\n3️⃣ Checking Draft Creation (Write)...');
        const draft = {
            subject: "Test Draft from Indigo POC Verification",
            body: {
                contentType: "HTML",
                content: "This is a test draft to verify write permissions."
            },
            toRecipients: [
                { emailAddress: { address: TARGET_EMAIL } }
            ]
        };
        const draftRes = await client.api(`/users/${TARGET_EMAIL}/messages`).post(draft);
        console.log(`   ✅ Draft Created! ID: ${draftRes.id}`);

        // 5. Send Email (Send Access)
        console.log('\n4️⃣ Checking Send Mail (Send Access)...');
        const mail = {
            subject: "Test Email from Indigo POC Verification",
            body: {
                contentType: "HTML",
                content: "<h1>Verification Successful</h1><p>This email confirms that the application can send emails as this user.</p>"
            },
            toRecipients: [
                { emailAddress: { address: TARGET_EMAIL } } // Sending to self
            ]
        };
        await client.api(`/users/${TARGET_EMAIL}/sendMail`)
            .post({ message: mail, saveToSentItems: true });
        console.log(`   ✅ Email Sent Successfully!`);

        console.log('\n🎉 All checks passed for CRINDIGO@minfytech.com');

    } catch (error: any) {
        console.error('\n❌ Verification Failed!');
        console.error('Error Details:', error.message || error);
        if (error.code) console.error('Error Code:', error.code);
        if (error.statusCode) console.error('Status Code:', error.statusCode);
    }
}

verifyMailbox().catch(console.error);
