/*
  Warnings:

  - The columns mainGuildId and supportGuildId are being renamed instead
    of dropped, preserving the existing configuration.
  - The column description on medals is being renamed to requirements,
    preserving the existing medal descriptions.
  - Existing medals will be assigned to the "Geral" category.
  - New category-related fields and configuration fields will be added.
*/

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CATEGORY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CATEGORY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'CATEGORY_REMOVED';


-- Drop old unique index before renaming the column
DROP INDEX IF EXISTS "guild_configs_mainGuildId_key";


-- Rename existing guild configuration columns.
-- This preserves the data already stored in them.
ALTER TABLE "guild_configs"
RENAME COLUMN "mainGuildId" TO "requestGuildId";

ALTER TABLE "guild_configs"
RENAME COLUMN "supportGuildId" TO "deliveryGuildId";


-- Add catalog configuration fields.
ALTER TABLE "guild_configs"
ADD COLUMN "medalCatalogChannelId" TEXT,
ADD COLUMN "medalCatalogMessageId" TEXT;


-- Create medal categories table.
CREATE TABLE "medal_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medal_categories_pkey" PRIMARY KEY ("id")
);


-- Create the default category for existing medals.
INSERT INTO "medal_categories" (
    "id",
    "name",
    "description",
    "emoji",
    "position",
    "active",
    "createdAt",
    "updatedAt"
)
VALUES (
    'legacy-general',
    'Geral',
    'Categoria padrão para medalhas cadastradas anteriormente.',
    '🎖️',
    0,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);


-- Add new medal fields temporarily as nullable.
-- They will become required after existing data is migrated.
ALTER TABLE "medals"
ADD COLUMN "categoryId" TEXT,
ADD COLUMN "jurisprudence" TEXT,
ADD COLUMN "requirements" TEXT;


-- Preserve the old description as the new requirements field.
UPDATE "medals"
SET "requirements" = "description";


-- Assign existing medals to the default category.
UPDATE "medals"
SET "categoryId" = 'legacy-general';


-- Ensure no existing medal was left without requirements.
UPDATE "medals"
SET "requirements" = 'Não informado.'
WHERE "requirements" IS NULL;


-- Make the new medal fields required.
ALTER TABLE "medals"
ALTER COLUMN "requirements" SET NOT NULL;

ALTER TABLE "medals"
ALTER COLUMN "categoryId" SET NOT NULL;


-- Now that the data has been migrated,
-- remove the old description column.
ALTER TABLE "medals"
DROP COLUMN "description";


-- Make deliveryGuildId required.
--
-- The previous setup should already have a supportGuildId.
-- If it was NULL, PostgreSQL will stop here rather than silently
-- assigning the wrong server.


-- Make requestGuildId unique.
CREATE UNIQUE INDEX "guild_configs_requestGuildId_key"
ON "guild_configs"("requestGuildId");


-- Create category name unique constraint.
CREATE UNIQUE INDEX "medal_categories_name_key"
ON "medal_categories"("name");


-- Create additional indexes.
CREATE INDEX "audit_logs_ticketId_idx"
ON "audit_logs"("ticketId");

CREATE INDEX "audit_logs_medalId_idx"
ON "audit_logs"("medalId");

CREATE INDEX "medals_categoryId_idx"
ON "medals"("categoryId");

CREATE INDEX "medals_active_idx"
ON "medals"("active");

CREATE INDEX "tickets_medalId_idx"
ON "tickets"("medalId");

CREATE INDEX "tickets_status_idx"
ON "tickets"("status");


-- Add relationship between medals and categories.
ALTER TABLE "medals"
ADD CONSTRAINT "medals_categoryId_fkey"
FOREIGN KEY ("categoryId")
REFERENCES "medal_categories"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;