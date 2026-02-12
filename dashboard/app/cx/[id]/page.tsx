
import Link from 'next/link';
import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import { MessageType } from '@prisma/client';
import GridDisplay from '@/components/GridDisplay';

export const dynamic = 'force-dynamic';

export default async function CXDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const complaint = await prisma.complaint.findUnique({
        where: { id },
        include: {
            conversation: {
                orderBy: { createdAt: 'asc' },
                where: {
                    messageType: { not: MessageType.DRAFT }
                }
            }
        }
    });

    if (!complaint) {
        notFound();
    }

    // @ts-ignore
    const grid = complaint.investigationGrid as any;

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
                    {/* INVESTIGATION GRID */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-lg font-bold mb-4 text-gray-800">Investigation Grid</h2>
                        <GridDisplay grid={grid} showResolutionSection={true} />
                    </div>

                    {/* CONVERSATION */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-lg font-bold mb-4 text-gray-800">Conversation History</h2>
                        <div className="space-y-4">
                            {complaint.conversation.map((message, idx) => (
                                <div
                                    key={message.id}
                                    className={`rounded-lg p-4 ${message.authorType === 'CX' ? 'bg-blue-50 border-l-4 border-blue-500' :
                                        message.authorType === 'AGENT' ? 'bg-green-50 border-l-4 border-green-500' :
                                            'bg-purple-50 border-l-4 border-purple-500'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-sm text-gray-700">
                                            {message.authorType === 'CX' ? '👤 Customer' :
                                                message.authorType === 'AGENT' ? '🤖 AI Agent' :
                                                    '✈️ Base Operations'}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {new Date(message.createdAt).toLocaleString()}
                                        </span>
                                    </div>

                                    {message.messageType === MessageType.EMAIL ? (
                                        <div className="text-sm text-gray-700">
                                            <p className="font-medium mb-1">{(message.content as any).subject}</p>
                                            <div
                                                className="prose prose-sm max-w-none text-gray-700"
                                                dangerouslySetInnerHTML={{ __html: (message.content as any).body }}
                                            />
                                        </div>
                                    ) : message.messageType === MessageType.GRID ? (
                                        <div className="text-sm text-gray-700">
                                            <p className="font-medium mb-2">✅ Grid extracted with confidence: {(message.content as any).confidence?.pnr || 'N/A'}</p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-700">(Draft Message)</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
