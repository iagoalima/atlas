import { prisma } from "../infrastructure/database/prisma.js";

export async function getGuildConfig(guildId: string) {
  return prisma.guildConfig.findFirst({
    where: {
      requestGuildId: guildId,
    },
  });
}