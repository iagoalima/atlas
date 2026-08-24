/*
  Warnings:

  - Added the required column `robloxUsername` to the `tickets` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "robloxUsername" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ticket_proofs" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_proofs_ticketId_idx" ON "ticket_proofs"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_proofs_userId_idx" ON "ticket_proofs"("userId");

-- CreateIndex
CREATE INDEX "ticket_proofs_messageId_idx" ON "ticket_proofs"("messageId");

-- AddForeignKey
ALTER TABLE "ticket_proofs" ADD CONSTRAINT "ticket_proofs_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
