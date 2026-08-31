ALTER TABLE "guild_configs"
  ADD COLUMN "solicitationChannelId" TEXT,
  ADD COLUMN "solicitationsOpen" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "solicitationNoticeMessageId" TEXT,
  ADD COLUMN "solicitationNoticeDeleteAt" TIMESTAMP(3);

ALTER TABLE "tickets"
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "teamMessageId" TEXT;

CREATE INDEX "tickets_submittedAt_idx" ON "tickets"("submittedAt");

ALTER TABLE "ticket_proofs"
  ADD COLUMN "ticketMedalId" TEXT,
  ADD COLUMN "medalId" TEXT;

CREATE INDEX "ticket_proofs_ticketMedalId_idx" ON "ticket_proofs"("ticketMedalId");
CREATE INDEX "ticket_proofs_medalId_idx" ON "ticket_proofs"("medalId");

ALTER TABLE "ticket_proofs"
  ADD CONSTRAINT "ticket_proofs_ticketMedalId_fkey"
  FOREIGN KEY ("ticketMedalId") REFERENCES "ticket_medals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ticket_proofs"
  ADD CONSTRAINT "ticket_proofs_medalId_fkey"
  FOREIGN KEY ("medalId") REFERENCES "medals"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
