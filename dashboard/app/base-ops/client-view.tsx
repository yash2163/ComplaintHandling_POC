'use client';

import { useState, useTransition } from 'react';
import { generateDraft, approveResponse } from '@/app/actions';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function BaseOpsClientView({ complaints, station, selectedId }: { complaints: any[], station: string, selectedId?: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [crewNotes, setCrewNotes] = useState('');
    const [draftEdits, setDraftEdits] = useState('');

    console.log('[BaseOpsClientView] Render:', { complaintsCount: complaints.length, station, selectedId });
    const selectedComplaint = complaints.find(c => c.id === selectedId);
    console.log('[BaseOpsClientView] Selected:', selectedComplaint?.id, 'Messages:', selectedComplaint?.conversation?.length);

    // Find messages
    const gridMsg = selectedComplaint?.conversation.find((m: any) => m.messageType === 'GRID');
    const emailMsg = selectedComplaint?.conversation.find((m: any) => m.messageType === 'EMAIL');
    const draftMsg = selectedComplaint?.conversation.find((m: any) => m.messageType === 'DRAFT');

    const handleGenerate = () => {
        if (!selectedId || !crewNotes) return;
        startTransition(async () => {
            await generateDraft(selectedId, crewNotes);
        });
    };

    const handleApprove = () => {
        if (!selectedId) return;
        const finalBody = draftEdits || (draftMsg?.content as any)?.text;
        if (!finalBody) return;

        startTransition(async () => {
            await approveResponse(selectedId, finalBody);
        });
    };

    return (
        <div className="flex h-[calc(100vh-80px)]">
            {/* LEFT SIDEBAR: LIST */}
            <div className="w-1/3 border-r bg-white flex flex-col">
                <div className="p-4 border-b bg-gray-50">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Base Location</label>
                    <select
                        className="w-full border-gray-300 rounded-md shadow-sm p-2"
                        value={station}
                        onChange={(e) => router.push(`/base-ops?station=${e.target.value}`)}
                    >
                        <option value="">Select Station...</option>
                        <option value="DEL">Delhi (DEL)</option>
                        <option value="BOM">Mumbai (BOM)</option>
                        <option value="BLR">Bangalore (BLR)</option>
                        <option value="HYD">Hyderabad (HYD)</option>
                        <option value="CCU">Kolkata (CCU)</option>
                    </select>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {complaints.map(c => (
                        <Link
                            key={c.id}
                            href={`/base-ops?station=${station}&id=${c.id}`}
                            className={`block p-4 border-b hover:bg-indigo-50 transition-colors ${c.id === selectedId ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''}`}
                        >
                            <div className="font-semibold text-gray-900 truncate">{c.subject}</div>
                            <div className="flex justify-between mt-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'WAITING_OPS' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
                                    {c.status}
                                </span>
                                <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</span>
                            </div>
                        </Link>
                    ))}
                    {complaints.length === 0 && (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            No complaints for {station || 'selection'}.
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT MAIN: WORKFLOW */}
            <div className="w-2/3 bg-gray-50 p-6 overflow-y-auto">
                {!selectedComplaint ? (
                    <div className="h-full flex items-center justify-center text-gray-400">
                        Select a complaint to take action.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* 1. VIEW CONTEXT */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border">
                            <h2 className="text-lg font-bold text-gray-800 mb-4">Case Context</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="border p-4 rounded bg-gray-50">
                                    <div className="text-xs text-gray-500 uppercase font-bold mb-2">Original Email</div>
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{(emailMsg?.content as any)?.body}</p>
                                </div>
                                <div className="border p-4 rounded bg-indigo-50 border-indigo-100">
                                    <div className="text-xs text-indigo-500 uppercase font-bold mb-2">Agent Extraction (Hint)</div>
                                    <div className="bg-white rounded border overflow-hidden">
                                        <table className="min-w-full text-sm">
                                            <tbody className="divide-y divide-indigo-100">
                                                {Object.entries((gridMsg?.content as any)?.gridFields || {}).map(([key, value]) => (
                                                    <tr key={key}>
                                                        <td className="px-3 py-2 bg-indigo-50/50 font-medium text-indigo-700 capitalize w-1/3">
                                                            {key.replace(/_/g, ' ')}
                                                        </td>
                                                        <td className="px-3 py-2 text-indigo-900">
                                                            {String(value || '-')}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {!gridMsg && (
                                                    <tr>
                                                        <td colSpan={2} className="px-3 py-4 text-center text-indigo-400 italic">
                                                            Waiting for AI extraction...
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. OPS INPUT */}
                        {selectedComplaint.status === 'WAITING_OPS' || selectedComplaint.status === 'PROCESSING' ? (
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-yellow-200">
                                <h2 className="text-lg font-bold text-gray-800 mb-4">Step 1: Crew Coordination</h2>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Enter Flight Crew / Operational Notes
                                </label>
                                <textarea
                                    className="w-full border rounded-md p-3 h-32 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g. Captain confirmed delay was due to technical fault in hydraulic system..."
                                    value={crewNotes}
                                    onChange={e => setCrewNotes(e.target.value)}
                                    disabled={isPending}
                                />
                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={handleGenerate}
                                        disabled={!crewNotes || isPending}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {isPending ? 'Generating...' : 'Generate Customer Response (Agent 2)'}
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {/* 3. DRAFT REVIEW */}
                        {selectedComplaint.status === 'DRAFT_READY' && draftMsg ? (
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-orange-200">
                                <h2 className="text-lg font-bold text-gray-800 mb-4">Step 2: Review & Approve</h2>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Generated Draft Response
                                </label>
                                <textarea
                                    className="w-full border rounded-md p-3 h-64 font-serif text-gray-800 focus:ring-green-500 focus:border-green-500"
                                    defaultValue={(draftMsg.content as any).text}
                                    onChange={e => setDraftEdits(e.target.value)}
                                    disabled={isPending}
                                />
                                <div className="mt-4 flex justify-between items-center">
                                    <span className="text-sm text-gray-500">Edit the text above if needed.</span>
                                    <button
                                        onClick={handleApprove}
                                        disabled={isPending}
                                        className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 font-bold"
                                    >
                                        {isPending ? 'Finalizing...' : 'Approve & Send Final'}
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {/* 4. APPROVED STATE */}
                        {selectedComplaint.status === 'APPROVED' && (
                            <div className="bg-green-50 p-6 rounded-lg border border-green-200 text-center">
                                <h2 className="text-2xl font-bold text-green-700 mb-2">✓ Case Closed</h2>
                                <p className="text-green-800">Response successfully generated and recorded.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
