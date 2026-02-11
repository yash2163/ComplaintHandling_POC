'use client';

export interface GridData {
    pnr?: string | null;
    customer_name?: string | null;
    flight_number?: string | null;
    seat_number?: string | null;
    source?: string | null;
    destination?: string | null;
    complaint?: string | null;
    issue_type?: string | null;
    weather_condition?: string | null;
    date?: string | null;
    action_taken?: string | null;
    outcome?: string | null;
    agent_summary?: string | null;
    confidence_score?: number | null;
    agent_reasoning?: string | null;
}

interface GridDisplayProps {
    grid: GridData | null;
    showResolutionSection?: boolean;
}

export default function GridDisplay({ grid, showResolutionSection = true }: GridDisplayProps) {
    if (!grid) {
        return (
            <div className="p-4 bg-gray-50 rounded border border-gray-200">
                <p className="text-gray-500 text-sm">No grid data available</p>
            </div>
        );
    }

    const getConfidenceColor = (score: number | null | undefined): string => {
        if (score === null || score === undefined) return 'text-gray-600';
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getConfidenceBgColor = (score: number | null | undefined): string => {
        if (score === null || score === undefined) return 'bg-gray-100';
        if (score >= 80) return 'bg-green-50';
        if (score >= 60) return 'bg-yellow-50';
        return 'bg-red-50';
    };

    const hasResolution = grid.action_taken || grid.outcome || grid.agent_summary || grid.confidence_score;

    return (
        <div className="space-y-4">
            {/* Complaint Details Section */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">Complaint Details</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div>
                        <span className="text-gray-600">PNR:</span>
                        <span className="ml-2 font-medium text-gray-900">{grid.pnr || '-'}</span>
                    </div>
                    <div>
                        <span className="text-gray-600">Customer Name:</span>
                        <span className="ml-2 font-medium text-gray-900">{grid.customer_name || '-'}</span>
                    </div>
                    <div>
                        <span className="text-gray-600">Flight Number:</span>
                        <span className="ml-2 font-medium text-gray-900">{grid.flight_number || '-'}</span>
                    </div>
                    <div>
                        <span className="text-gray-600">Seat Number:</span>
                        <span className="ml-2 font-medium text-gray-900">{grid.seat_number || '-'}</span>
                    </div>
                    <div>
                        <span className="text-gray-600">Source:</span>
                        <span className="ml-2 font-medium text-gray-900">{grid.source || '-'}</span>
                    </div>
                    <div>
                        <span className="text-gray-600">Destination:</span>
                        <span className="ml-2 font-medium text-gray-900">{grid.destination || '-'}</span>
                    </div>
                    <div className="col-span-2">
                        <span className="text-gray-600">Complaint:</span>
                        <p className="mt-1 text-gray-900 bg-white p-2 rounded border border-blue-200">{grid.complaint || '-'}</p>
                    </div>
                    <div>
                        <span className="text-gray-600">Issue Type:</span>
                        <span className="ml-2 font-medium text-gray-900">{grid.issue_type || '-'}</span>
                    </div>
                    <div>
                        <span className="text-gray-600">Date:</span>
                        <span className="ml-2 font-medium text-gray-900">{grid.date || '-'}</span>
                    </div>
                    {grid.weather_condition && (
                        <div className="col-span-2">
                            <span className="text-gray-600">Weather Condition:</span>
                            <span className="ml-2 font-medium text-gray-900">{grid.weather_condition}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Resolution Section */}
            {showResolutionSection && hasResolution && (
                <div className={`rounded-lg p-4 border ${getConfidenceBgColor(grid.confidence_score)} ${grid.confidence_score && grid.confidence_score >= 60 ? 'border-green-200' : 'border-red-200'}`}>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Resolution Details</h3>
                    <div className="grid grid-cols-1 gap-y-2 text-sm">
                        {grid.action_taken && (
                            <div>
                                <span className="text-gray-600">Action Taken:</span>
                                <p className="mt-1 text-gray-900 bg-white p-2 rounded border">{grid.action_taken}</p>
                            </div>
                        )}
                        {grid.outcome && (
                            <div>
                                <span className="text-gray-600">Outcome:</span>
                                <p className="mt-1 text-gray-900 bg-white p-2 rounded border">{grid.outcome}</p>
                            </div>
                        )}
                        {grid.agent_summary && (
                            <div>
                                <span className="text-gray-600">Agent Summary:</span>
                                <p className="mt-1 text-gray-900 bg-white p-2 rounded border">{grid.agent_summary}</p>
                            </div>
                        )}
                        {grid.confidence_score !== null && grid.confidence_score !== undefined && (
                            <div>
                                <span className="text-gray-600">Confidence Score:</span>
                                <span className={`ml-2 font-bold text-lg ${getConfidenceColor(grid.confidence_score)}`}>
                                    {grid.confidence_score}%
                                </span>
                                <span className="ml-2 text-xs text-gray-500">
                                    ({grid.confidence_score >= 80 ? 'Excellent' : grid.confidence_score >= 60 ? 'Partial' : 'Poor'})
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
