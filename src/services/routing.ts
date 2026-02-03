export class RoutingService {
    // Map Origin Station Code -> Base Ops Location Name (or ID)
    // In a real app table, this would be a DB lookup.
    private stationMap: Record<string, string> = {
        'DEL': 'Delhi Base Ops',
        'BOM': 'Mumbai Base Ops',
        'BLR': 'Bangalore Base Ops',
        'HYD': 'Hyderabad Base Ops',
        'CCU': 'Kolkata Base Ops'
    };

    public getBaseOpsTeam(station: string | null): string {
        if (!station) return 'Unassigned';

        // Normalize (ucase)
        const code = station.toUpperCase().trim();

        return this.stationMap[code] || 'Unassigned';
    }
}
