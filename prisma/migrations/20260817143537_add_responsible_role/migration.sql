-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'MEDAL_SELF_DELIVERY_ATTEMPT';

-- AlterTable
ALTER TABLE "guild_configs" ADD COLUMN     "responsibleRoleId" TEXT;
