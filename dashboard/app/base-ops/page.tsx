import prisma from '@/lib/db';
import BaseOpsClientView from './client-view';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function BaseOpsPage({ searchParams }: { searchParams: Promise<{ station?: string, id?: string }> }) {
    const params = await searchParams;
    const station = params.station || '';

    // Fetch complaints that are waiting for Base Ops action
    const complaints = await prisma.complaint.findMany({
        where: {
            status: 'WAITING_OPS'
        },
        include: {
            conversation: true
        },
        orderBy: { updatedAt: 'desc' }
    });

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <header className="bg-white shadow-sm z-10 p-4 flex justify-between items-center border-b">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <span className="bg-rose-100 text-rose-800 text-xs px-2 py-1 rounded">Base Ops Portal</span>
                    {station ? `${station} Station` : 'Select Station'}
                </h1>
                <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">Exit to Home</Link>
            </header>

            <BaseOpsClientView
                complaints={complaints as any}
                station={station}
                selectedId={params.id}
            />
        </div>
    );
}
