ALTER TABLE "guild_configs"
  ADD COLUMN "requestPanelChannelId" TEXT,
  ADD COLUMN "requestPanelMessageId" TEXT,
  ADD COLUMN "requestReviewChannelId" TEXT,
  ADD COLUMN "requestsOpen" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ticket_proofs"
  ADD COLUMN "medalId" TEXT;

ALTER TABLE "tickets"
  ADD COLUMN "proofCollectionIndex" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "ticket_proofs_medalId_idx" ON "ticket_proofs"("medalId");
