ALTER TABLE "tickets" ADD COLUMN "requestGuildId" TEXT;
CREATE INDEX "tickets_requestGuildId_idx" ON "tickets"("requestGuildId");
