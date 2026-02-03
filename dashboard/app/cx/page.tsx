import Link from 'next/link';
import prisma from '@/lib/db';
import { ComplaintStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function CXListPage() {
    const complaints = await prisma.complaint.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            conversation: {
                take: 1,
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">CX Inbox (Read-Only)</h1>
                    <Link href="/" className="text-indigo-600 hover:underline">Back to Home</Link>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origin (Hint)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {complaints.map((complaint) => (
                                <tr key={complaint.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Link href={`/cx/${complaint.id}`} className="block text-indigo-600 font-medium hover:underline truncate max-w-md">
                                            {complaint.subject}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${complaint.status === 'NEW' ? 'bg-blue-100 text-blue-800' : ''}
                      ${complaint.status === 'WAITING_OPS' ? 'bg-yellow-100 text-yellow-800' : ''}
                      ${complaint.status === 'PROCESSING' ? 'bg-purple-100 text-purple-800' : ''}
                      ${complaint.status === 'DRAFT_READY' ? 'bg-orange-100 text-orange-800' : ''}
                      ${complaint.status === 'APPROVED' ? 'bg-green-100 text-green-800' : ''}
                    `}>
                                            {complaint.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {complaint.originStation || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(complaint.createdAt).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {complaints.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                                        No complaints found. Send an email to the monitored inbox (or simulate one).
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
