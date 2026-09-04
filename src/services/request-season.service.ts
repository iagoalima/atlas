import {
  ContainerBuilder,
  Guild,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from "discord.js";
import { prisma } from "../infrastructure/database/prisma.js";

const ANNOUNCEMENT_LIFETIME_MS = 24 * 60 * 60 * 1000;

export async function getRequestState(guildId: string): Promise<boolean> {
  const config = await prisma.guildConfig.findUnique({
    where: { requestGuildId: guildId },
    select: { requestsOpen: true },
  });

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
  const config = await prisma.guildConfig.findUnique({
    where: { requestGuildId: guild.id },
  });

  if (!config?.requestPanelChannelId) return;

  const channel = await guild.channels.fetch(config.requestPanelChannelId).catch(() => null);
  if (!channel?.isTextBased() || !channel.isSendable()) return;

  const container = new ContainerBuilder()
    .setAccentColor(open ? 0x2ecc71 : 0xe74c3c)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        open
          ? "# 🟢 Solicitações retomadas"
          : "# 🔴 Solicitações encerradas"
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        open
          ? [
              "## 🎖️ Temporada reaberta",
              "",
              "As solicitações de medalhas estão **abertas novamente**.",
              "",
              "Utilize o painel de solicitações para iniciar uma nova solicitação.",
              "",
              "-# As solicitações já registradas continuam normalmente em análise.",
            ].join("\n")
          : [
              "## 🔒 Temporada encerrada",
              "",
              "As novas solicitações de medalhas estão **temporariamente fechadas**.",
              "",
              "Solicitações que já foram enviadas continuam normalmente em análise e conclusão.",
              "",
              "-# Aguarde uma nova abertura da temporada para realizar outra solicitação.",
            ].join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        open
          ? "-# Atlas • Sistema de Solicitações de Medalhas"
          : "-# Atlas • Sistema de Solicitações de Medalhas"
      )
    );

  const message = await channel.send({
    content: "@everyone",
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: ["everyone"] },
  });

  setTimeout(() => {
    void message.delete().catch(() => undefined);
  }, ANNOUNCEMENT_LIFETIME_MS);
}
