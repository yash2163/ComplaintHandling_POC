import prisma from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface GridData {
    pnr?: string | null;
    customer_name?: string | null;
    flight_number?: string | null;
    complaint?: string | null;
    issue_type?: string | null;
    confidence_score?: number | null;
    agent_summary?: string | null;
}

export default async function CRTeamPage() {
    const complaints = await prisma.complaint.findMany({
        where: {
            OR: [
                { resolutionStatus: 'FLAGGED' },
                { resolutionStatus: 'RESOLVED' }
            ]
        },
        orderBy: { updatedAt: 'desc' },
        take: 50
    });

    const getConfidenceColor = (score: number | null | undefined): string => {
        if (score === null || score === undefined) return 'text-gray-600';
        if (score >= 80) return 'text-green-600 font-bold';
        if (score >= 60) return 'text-yellow-600 font-bold';
        return 'text-red-600 font-bold';
    };

    const getStatusBadge = (status: string) => {
        const colors: any = {
            FLAGGED: 'bg-red-100 text-red-800 border-red-300',
            RESOLVED: 'bg-green-100 text-green-800 border-green-300',
            PENDING: 'bg-gray-100 text-gray-800 border-gray-300'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Navigation Bar */}
                <div className="mb-4">
                    <Link href="/" className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Back to Home
                    </Link>
                </div>

                <h1 className="text-3xl font-bold text-gray-800 mb-6">CR Team - Resolutions Review</h1>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PNR</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Summary</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {complaints.map((complaint) => {
                                const grid = complaint.investigationGrid as GridData | null;
                                return (
                                    <tr key={complaint.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {grid?.pnr || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            <Link href={`/cx/${complaint.id}`} className="text-indigo-600 hover:underline">
                                                {complaint.subject}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {grid?.issue_type || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs rounded border ${getStatusBadge(complaint.resolutionStatus)}`}>
                                                {complaint.resolutionStatus}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={getConfidenceColor(grid?.confidence_score)}>
                                                {grid?.confidence_score !== null && grid?.confidence_score !== undefined ? `${grid.confidence_score}%` : '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">
                                            {grid?.agent_summary || '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
