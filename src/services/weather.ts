import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface MetarData {
    metarRaw: string;
    wind?: string;
    visibility?: string;
    weather?: string;
    clouds?: string;
    temperature?: string;
    impact?: string;
}

export class WeatherService {
    /**
     * Fetch weather data for a specific flight, date, and origin.
     */
    public async getWeatherForFlight(flightNumber: string, date: Date, originStation: string): Promise<MetarData | null> {
        try {
            // Find a matching weather record within a reasonable time window
            // For this POC, we are matching primarily on Date (ignoring precise time for simplicity)
            // In a real system, we'd match closer to departure time.

            // Normalize dates to start of day for comparison if needed, or exact match if seeded correctly
            // The POC seeding uses a specific ISO string.

            // For flexibility, let's find the record for this flight/date/origin
            const record = await prisma.flightWeather.findFirst({
                where: {
                    flightNumber: flightNumber,
                    originStation: originStation,
                    // Simple date match: check if record's date is on the same day
                    date: {
                        gte: new Date(date.setHours(0, 0, 0, 0)),
                        lt: new Date(date.setHours(23, 59, 59, 999))
                    }
                }
            });

            if (!record) return null;

            return {
                metarRaw: record.metarRaw,
                wind: record.wind || undefined,
                visibility: record.visibility || undefined,
                weather: record.weather || undefined,
                clouds: record.clouds || undefined,
                temperature: record.temperature || undefined,
                impact: record.impact || undefined
            };

        } catch (error) {
            console.error('Failed to fetch weather data:', error);
            return null;
        }
    }

    /**
     * Check if the weather conditions are "adverse" enough to likely cause delays.
     * This is a heuristics helper. Real logic would be more complex.
     */
    public isAdverseWeather(weather: MetarData): boolean {
        const adverseCodes = ['HZ', 'TS', 'FG', 'SN', 'GR']; // Haze, Thunderstorm, Fog, Snow, Hail
        const lowVisibilityThreshold = 1500; // Meters

        // Check weather codes
        if (weather.weather && adverseCodes.some(code => weather.weather!.includes(code))) {
            return true;
        }

        // Check visibility (parse number from string like "4000 meters")
        if (weather.visibility) {
            const visMatch = weather.visibility.match(/(\d+)/);
            if (visMatch) {
                const visMeters = parseInt(visMatch[1]);
                if (visMeters < lowVisibilityThreshold) return true;
            }
        }

        return false;
    }
}
