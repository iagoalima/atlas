import { Guild } from "discord.js";
import { prisma } from "../infrastructure/database/prisma.js";

export async function getRequestState(guildId: string): Promise<boolean> {
  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: guildId }, select: { requestsOpen: true } });
  return config?.requestsOpen ?? false;
}

export async function setRequestsOpen(guildId: string, open: boolean): Promise<void> {
  await prisma.guildConfig.upsert({
    where: { requestGuildId: guildId },
    update: { requestsOpen: open },
    create: {
      requestGuildId: guildId,
      requestsOpen: open,
      ticketCategoryId: "UNCONFIGURED",
      logChannelId: "UNCONFIGURED",
      transcriptChannelId: "UNCONFIGURED",
      staffRoleId: "UNCONFIGURED",
    },
  });
}

export async function announceRequestState(guild: Guild, open: boolean): Promise<void> {
  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: guild.id } });
  if (!config?.requestPanelChannelId) return;
  const channel = await guild.channels.fetch(config.requestPanelChannelId).catch(() => null);
  if (!channel?.isTextBased() || !channel.isSendable()) return;

  const message = await channel.send({
    content: open
      ? "## 🟢 Solicitações de medalhas retomadas\n\nAs solicitações de medalhas estão abertas novamente. Você já pode utilizar o botão abaixo para enviar sua solicitação."
      : "## 🔴 Solicitações de medalhas encerradas\n\nNovas solicitações estão temporariamente fechadas. As solicitações já enviadas continuam normalmente em análise.",
  });

  if (open) {
    setTimeout(async () => {
      try { await message.delete(); } catch {}
    }, 3 * 60 * 60 * 1000);
  }
}
