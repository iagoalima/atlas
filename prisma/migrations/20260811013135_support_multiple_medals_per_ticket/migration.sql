/*
  Warnings:

  - You are about to drop the column `medalId` on the `tickets` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TicketMedalStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_medalId_fkey";

-- DropIndex
DROP INDEX "tickets_medalId_idx";

-- AlterTable
ALTER TABLE "tickets" DROP COLUMN "medalId";

-- CreateTable
CREATE TABLE "ticket_medals" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "medalId" TEXT NOT NULL,
    "status" "TicketMedalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_medals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_medals_ticketId_idx" ON "ticket_medals"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_medals_medalId_idx" ON "ticket_medals"("medalId");

-- CreateIndex
CREATE INDEX "ticket_medals_status_idx" ON "ticket_medals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_medals_ticketId_medalId_key" ON "ticket_medals"("ticketId", "medalId");

-- AddForeignKey
ALTER TABLE "ticket_medals" ADD CONSTRAINT "ticket_medals_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_medals" ADD CONSTRAINT "ticket_medals_medalId_fkey" FOREIGN KEY ("medalId") REFERENCES "medals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
