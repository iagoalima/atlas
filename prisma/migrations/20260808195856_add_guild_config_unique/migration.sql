/*
  Warnings:

  - A unique constraint covering the columns `[mainGuildId]` on the table `guild_configs` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "guild_configs_mainGuildId_key" ON "guild_configs"("mainGuildId");
