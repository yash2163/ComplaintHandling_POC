-- AlterEnum
ALTER TYPE "ComplaintStatus" ADD VALUE 'MISSING_INFO';

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "complaintDetail" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "destination" TEXT,
ADD COLUMN     "flightNumber" TEXT,
ADD COLUMN     "pnr" TEXT,
ADD COLUMN     "seatNumber" TEXT,
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "Passenger" (
    "pnr" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "seatNumber" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "destination" TEXT NOT NULL,

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("pnr")
);
