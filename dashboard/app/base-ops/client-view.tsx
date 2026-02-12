'use client';

import { useEffect, useState } from 'react';
import GridDisplay from '@/components/GridDisplay';

interface Complaint {
    id: string;
    subject: string;
    status: string;
    resolutionStatus: string;
    investigationGrid: any;
    conversation: any[];
}

interface ClientViewProps {
    complaints: Complaint[];
    station: string;
    selectedId?: string;
}

export default function ClientView({ complaints: initialComplaints, station, selectedId: initialSelectedId }: ClientViewProps) {
    const [complaints, setComplaints] = useState<Complaint[]>(initialComplaints);
    const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId || (initialComplaints.length > 0 ? initialComplaints[0].id : null));

    useEffect(() => {
        async function fetchData() {
            const res = await fetch('/api/complaints');
            const data = await res.json();
            setComplaints(data);
        }
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);


    const selected = complaints.find(c => c.id === selectedId);

    return (
        <div className="flex-1 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-3 gap-6">
                    {/* Complaint List */}
                    <div className="col-span-1 bg-white rounded-lg shadow p-4 max-h-screen overflow-y-auto">
                        <h2 className="text-lg font-bold mb-4 text-gray-800">Active Complaints</h2>
                        <div className="space-y-2">
                            {complaints.filter(c => c.status === 'WAITING_OPS').map((complaint) => (
                                <button
                                    key={complaint.id}
                                    onClick={() => setSelectedId(complaint.id)}
                                    className={`w-full text-left p-3 rounded border transition ${selectedId === complaint.id
                                        ? 'bg-indigo-50 border-indigo-500'
                                        : 'bg-white border-gray-200 hover:border-indigo-300'
                                        }`}
                                >
                                    <p className="font-medium text-sm text-gray-900 truncate">{complaint.subject}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        PNR: {(complaint.investigationGrid as any)?.pnr || '-'}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Complaint Detail */}
                    <div className="col-span-2 bg-white rounded-lg shadow p-6">
                        {selected ? (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800">{selected.subject}</h2>
                                    <p className="text-sm text-gray-500 mt-1">Ticket ID: {selected.id.substring(0, 8)}</p>
                                </div>

                                {/* Investigation Grid */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Investigation Grid</h3>
                                    <GridDisplay grid={selected.investigationGrid} showResolutionSection={true} />
                                </div>

                                {/* Instructions */}
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-yellow-900 mb-2">📧 Action Required</h4>
                                    <p className="text-sm text-yellow-800">
                                        Check your Outlook drafts for this complaint. Update the grid with:
                                    </p>
                                    <ul className="text-sm text-yellow-800 list-disc list-inside mt-2">
                                        <li><strong>Action Taken:</strong> What action did you take?</li>
                                        <li><strong>Outcome:</strong> What was the final result/compensation?</li>
                                    </ul>
                                    <p className="text-sm text-yellow-800 mt-2">
                                        Reply to the email with the <strong>complete updated grid</strong>.
                                    </p>
                                </div>

                                {/* Conversation History */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Message History</h3>
                                    <div className="space-y-3">
                                        {selected.conversation.map((msg) => (
                                            <div key={msg.id} className="bg-gray-50 rounded p-3 border border-gray-200">
                                                <p className="text-xs text-gray-500 mb-1">
                                                    {msg.authorType} • {new Date(msg.createdAt).toLocaleString()}
                                                </p>
                                                <div className="text-sm text-gray-700">
                                                    {msg.messageType === 'EMAIL' ? (
                                                        <div
                                                            className="prose prose-sm max-w-none"
                                                            dangerouslySetInnerHTML={{ __html: (msg.content as any).body }}
                                                        />
                                                    ) : (
                                                        'Grid/Draft'
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-500">Select a complaint to view details</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
