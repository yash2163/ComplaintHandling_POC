import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedWeather() {
    console.log('Seeding Weather Data...');

    // User Sample Request Data:
    // timestamp: "2026-01-27T08:30:00Z"
    // raw_metar: "VIDP 270830Z 27008KT 4000 HZ SCT020 18/12 Q1012 NOSIG"

    const weatherData = {
        flightNumber: '6E-202', // Matches our test case
        date: new Date('2026-01-27T00:00:00Z'), // Flight Date
        originStation: 'BLR',
        destinationStation: 'DEL',

        // Detailed fields
        metarRaw: 'VIDP 270830Z 27008KT 4000 HZ SCT020 18/12 Q1012 NOSIG',
        wind: '270° at 8 knots',
        visibility: '4000 meters (reduced due to haze)',
        weather: 'HZ (Haze)',
        clouds: 'Scattered at 2000 feet',
        temperature: '18°C',
        impact: 'Minor delays possible due to reduced visibility'
    };

    try {
        const existing = await prisma.flightWeather.findFirst({
            where: {
                flightNumber: weatherData.flightNumber,
                date: weatherData.date,
                originStation: weatherData.originStation
            }
        });

        if (existing) {
            console.log('Weather data already exists for this flight/date. Updating...');
            await prisma.flightWeather.update({
                where: { id: existing.id },
                data: { ...weatherData, id: existing.id }
            });
        } else {
            await prisma.flightWeather.create({
                data: weatherData
            });
            console.log('Created new weather record.');
        }

        console.log('✅ Weather Seeding Complete.');
    } catch (error) {
        console.error('Seeding failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seedWeather();
