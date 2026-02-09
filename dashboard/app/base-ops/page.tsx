import prisma from '@/lib/db';
import BaseOpsClientView from './client-view';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function BaseOpsPage({ searchParams }: { searchParams: Promise<{ station?: string, id?: string }> }) {
    const params = await searchParams;
    const station = params.station || '';

    // Fetch complaints for station (if selected)
    // If no station selected, show empty or all? The UI encourages selection.
    // We will fetch where status is NOT NEW (Agent 1 must have run)
    // and where originStation matches (if strict routing) or we handle "Unassigned"

    const complaints = await prisma.complaint.findMany({
        where: {
            // If station is selected, filter by it. Otherwise, show all.
            ...(station && { originStation: station }),
            status: {
                notIn: ['NEW', 'MISSING_INFO']
            }
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
                complaints={complaints}
                station={station}
                selectedId={params.id}
            />
        </div>
    );
}
