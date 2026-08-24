-- ============================================================
-- CORREÇÃO DO DRIFT DO BANCO DO ATLAS
-- Não apaga dados.
-- Apenas restaura índices e foreign key esperados pelo Prisma.
-- ============================================================


-- ============================================================
-- GUILD CONFIG
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS "guild_configs_requestGuildId_key"
ON "guild_configs" ("requestGuildId");


-- ============================================================
-- MEDAL CATEGORIES
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS "medal_categories_name_key"
ON "medal_categories" ("name");


-- ============================================================
-- MEDALS
-- ============================================================

CREATE INDEX IF NOT EXISTS "medals_categoryId_idx"
ON "medals" ("categoryId");

CREATE INDEX IF NOT EXISTS "medals_active_idx"
ON "medals" ("active");


-- ============================================================
-- TICKETS
-- ============================================================

CREATE INDEX IF NOT EXISTS "tickets_medalId_idx"
ON "tickets" ("medalId");

CREATE INDEX IF NOT EXISTS "tickets_status_idx"
ON "tickets" ("status");


-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE INDEX IF NOT EXISTS "audit_logs_ticketId_idx"
ON "audit_logs" ("ticketId");

CREATE INDEX IF NOT EXISTS "audit_logs_medalId_idx"
ON "audit_logs" ("medalId");


-- ============================================================
-- RELAÇÃO MEDAL -> MEDAL CATEGORY
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'medals_categoryId_fkey'
  ) THEN

    ALTER TABLE "medals"
    ADD CONSTRAINT "medals_categoryId_fkey"
    FOREIGN KEY ("categoryId")
    REFERENCES "medal_categories"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

  END IF;
END $$;