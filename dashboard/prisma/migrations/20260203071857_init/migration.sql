-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('NEW', 'WAITING_OPS', 'PROCESSING', 'DRAFT_READY', 'APPROVED');

-- CreateEnum
CREATE TYPE "AuthorType" AS ENUM ('CX', 'AGENT', 'BASE_OPS');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('EMAIL', 'GRID', 'DRAFT', 'FINAL');

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "originalEmailId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'NEW',
    "originStation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "authorType" "AuthorType" NOT NULL,
    "messageType" "MessageType" NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_originalEmailId_key" ON "Complaint"("originalEmailId");

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
