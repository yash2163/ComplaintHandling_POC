
import Link from 'next/link';
import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import { MessageType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function CXDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const complaint = await prisma.complaint.findUnique({
        where: { id },
        include: {
            conversation: {
                orderBy: { createdAt: 'asc' },
                where: {
                    // Gap 3: Hide DRAFTS from CX
                    messageType: { not: MessageType.DRAFT }
                }
            }
        }
    });

    if (!complaint) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <Link href="/cx" className="text-indigo-600 hover:underline mb-2 block">← Back to Inbox</Link>
                    <h1 className="text-3xl font-bold text-gray-800">{complaint.subject}</h1>
                    <p className="text-gray-500">
                        Ticket ID: {complaint.id.substring(0, 8)} •
                        Status: <span className="font-semibold">{complaint.status}</span>
                    </p>
                </div>

                <div className="space-y-6">
                    {complaint.conversation.map((msg) => (
                        <MessageItem key={msg.id} msg={msg} />
                    ))}

                    {complaint.conversation.length === 0 && (
                        <div className="text-center text-gray-400 italic">No messages yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function MessageItem({ msg }: { msg: any }) {
    const content = msg.content as any;
    const isAgent = msg.authorType === 'AGENT';
    const isCX = msg.authorType === 'CX';
    const isOps = msg.authorType === 'BASE_OPS';

    return (
        <div className={`flex ${isCX ? 'justify-start' : 'justify-end'}`}>
            <div className={`
                max-w-3xl w-full rounded-lg shadow-sm border p-5 relative
                ${isCX ? 'bg-white border-gray-200' : ''}
                ${isAgent ? 'bg-indigo-50 border-indigo-100' : ''}
                ${isOps ? 'bg-green-50 border-green-100' : ''}
            `}>
                <div className="flex justify-between items-center mb-3">
                    <span className={`text-xs font-bold uppercase tracking-wide
                        ${isCX ? 'text-gray-500' : ''}
                        ${isAgent ? 'text-indigo-600' : ''}
                        ${isOps ? 'text-green-600' : ''}
                    `}>
                        {msg.authorType} {msg.messageType !== 'EMAIL' ? `• ${msg.messageType}` : ''}
                    </span>
                    <span className="text-xs text-gray-400">
                        {new Date(msg.createdAt).toLocaleString()}
                    </span>
                </div>

                {/* EMAIL CONTENT */}
                {msg.messageType === 'EMAIL' && (
                    <div>
                        <div className="text-xs text-gray-500 mb-2">From: {content.from}</div>
                        <div className="whitespace-pre-wrap text-gray-800 font-serif leading-relaxed">
                            {content.body}
                        </div>
                    </div>
                )}

                {/* GRID CONTENT */}
                {msg.messageType === 'GRID' && (
                    <div>
                        <div className="mb-2 text-indigo-700 font-semibold text-sm">Extracted Investigation Grid:</div>
                        <div className="bg-white rounded border overflow-hidden">
                            <table className="min-w-full text-sm">
                                <tbody className="divide-y divide-gray-100">
                                    {Object.entries(content.gridFields || {}).map(([key, value]) => (
                                        <tr key={key}>
                                            <td className="px-3 py-2 bg-gray-50 font-medium text-gray-600 capitalize">
                                                {key.replace('_', ' ')}
                                            </td>
                                            <td className="px-3 py-2 text-gray-900">
                                                {String(value || '-')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* FINAL RESPONSE CONTENT */}
                {msg.messageType === 'FINAL' && (
                    <div>
                        <div className="mb-2 text-green-700 font-semibold text-sm">Response Sent to Customer:</div>
                        <div className="whitespace-pre-wrap text-gray-800 bg-white p-3 rounded border border-green-200">
                            {content.text}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
