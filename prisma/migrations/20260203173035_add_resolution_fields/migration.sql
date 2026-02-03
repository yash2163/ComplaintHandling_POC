-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('PENDING', 'RESOLVED', 'FLAGGED');

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "agentReasoning" TEXT,
ADD COLUMN     "resolutionStatus" "ResolutionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "resolutionSummary" TEXT;
