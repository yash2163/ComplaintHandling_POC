-- CreateEnum
CREATE TYPE "CRReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "confidenceScore" INTEGER,
ADD COLUMN     "crReviewStatus" "CRReviewStatus" NOT NULL DEFAULT 'PENDING';
