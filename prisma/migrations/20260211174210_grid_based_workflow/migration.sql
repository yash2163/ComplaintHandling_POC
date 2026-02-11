/*
  Warnings:

  - You are about to drop the column `agentReasoning` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `complaintDetail` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `confidenceScore` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `customerName` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `destination` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `flightNumber` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `originStation` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `pnr` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `resolutionAction` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `resolutionOutcome` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `resolutionSummary` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `seatNumber` on the `Complaint` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `Complaint` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Complaint" DROP COLUMN "agentReasoning",
DROP COLUMN "complaintDetail",
DROP COLUMN "confidenceScore",
DROP COLUMN "customerName",
DROP COLUMN "destination",
DROP COLUMN "flightNumber",
DROP COLUMN "originStation",
DROP COLUMN "pnr",
DROP COLUMN "resolutionAction",
DROP COLUMN "resolutionOutcome",
DROP COLUMN "resolutionSummary",
DROP COLUMN "seatNumber",
DROP COLUMN "source",
ADD COLUMN     "investigationGrid" JSONB;
