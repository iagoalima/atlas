ALTER TABLE "guild_configs"
  ADD COLUMN "requestPanelChannelId" TEXT,
  ADD COLUMN "requestPanelMessageId" TEXT,
  ADD COLUMN "requestReviewChannelId" TEXT,
  ADD COLUMN "requestsOpen" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "tickets"
  ADD COLUMN "proofCollectionIndex" INTEGER NOT NULL DEFAULT 0;
