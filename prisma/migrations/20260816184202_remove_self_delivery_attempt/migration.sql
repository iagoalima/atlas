/*
  Warnings:

  - The values [MEDAL_SELF_DELIVERY_ATTEMPT] on the enum `AuditAction` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AuditAction_new" AS ENUM ('TICKET_CREATED', 'TICKET_CLOSED', 'TICKET_DELETED', 'MEDAL_CREATED', 'MEDAL_UPDATED', 'MEDAL_REMOVED', 'MEDAL_APPROVED', 'MEDAL_GRANTED', 'MEDAL_DENIED', 'MEDAL_SELF_DELIVERY_BLOCKED', 'TRANSCRIPT_CREATED', 'CONFIG_UPDATED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'CATEGORY_REMOVED');
ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE "AuditAction_new" USING ("action"::text::"AuditAction_new");
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";
DROP TYPE "public"."AuditAction_old";
COMMIT;
