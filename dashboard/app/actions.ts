'use server';

import prisma from '@/lib/db';
import { AgentService } from '@/lib/agent';
import { AuthorType, MessageType, ComplaintStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const agent = new AgentService();
// Ensure env vars are loaded for AgentService (GOOGLE_API_KEY)
// Next.js loads .env automatically in server context? Yes.

export async function generateDraft(complaintId: string, crewNotes: string) {
    // 1. Get Complaint + Grid
    const complaint = await prisma.complaint.findUnique({
        where: { id: complaintId },
        include: { conversation: true }
    });

    if (!complaint) throw new Error('Complaint not found');

    const gridMsg = complaint.conversation.find(m => m.messageType === MessageType.GRID);
    // Grid content is Json, need casting
    const gridContent = gridMsg?.content as any;
    const grid = gridContent?.gridFields || {}; // Fallback

    // 2. Call Agent 2
    // We need to implement generateDraftResponse in dashboard/lib/agent.ts
    // (We copied it from src/services/agent.ts so it should be there)
    const draftBody = await agent.generateDraftResponse(grid, crewNotes);

    // 3. Save DRAFT message
    await prisma.$transaction([
        prisma.conversationMessage.create({
            data: {
                complaintId: complaint.id,
                authorType: AuthorType.AGENT,
                messageType: MessageType.DRAFT,
                content: { text: draftBody }
            }
        }),
        prisma.complaint.update({
            where: { id: complaint.id },
            data: {
                status: ComplaintStatus.DRAFT_READY,
                // We could store crewNotes somewhere if we wanted audit, 
                // strictly speaking they are input to the action but not persisted in schema explicitly
                // unless we add a CREW_NOTE message type. For now, implicit in the draft generation.
            }
        })
    ]);

    revalidatePath('/base-ops');
    revalidatePath(`/base-ops?id=${complaintId}`); // reload if params used
}

export async function approveResponse(complaintId: string, finalBody: string) {
    await prisma.$transaction([
        prisma.conversationMessage.create({
            data: {
                complaintId,
                authorType: AuthorType.BASE_OPS,
                messageType: MessageType.FINAL,
                content: { text: finalBody }
            }
        }),
        prisma.complaint.update({
            where: { id: complaintId },
            data: { status: ComplaintStatus.APPROVED }
        })
    ]);

    revalidatePath('/base-ops');
    revalidatePath('/cx');
}
