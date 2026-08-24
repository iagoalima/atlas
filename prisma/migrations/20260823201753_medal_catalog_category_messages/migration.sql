/*
  Warnings:

  - You are about to drop the column `medalCatalogMessageId` on the `guild_configs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "guild_configs" DROP COLUMN "medalCatalogMessageId";

-- AlterTable
ALTER TABLE "medal_categories" ADD COLUMN     "catalogMessageId" TEXT;
