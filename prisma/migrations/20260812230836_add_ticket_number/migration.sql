/*
  Warnings:

  - A unique constraint covering the columns `[ticketNumber]` on the table `tickets` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "ticketNumber" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticketNumber_key" ON "tickets"("ticketNumber");
