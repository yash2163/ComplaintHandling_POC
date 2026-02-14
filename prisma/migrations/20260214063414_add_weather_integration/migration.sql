-- CreateTable
CREATE TABLE "FlightWeather" (
    "id" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "originStation" TEXT NOT NULL,
    "destinationStation" TEXT NOT NULL,
    "metarRaw" TEXT NOT NULL,
    "wind" TEXT,
    "visibility" TEXT,
    "weather" TEXT,
    "clouds" TEXT,
    "temperature" TEXT,
    "impact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlightWeather_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlightWeather_flightNumber_date_originStation_key" ON "FlightWeather"("flightNumber", "date", "originStation");
