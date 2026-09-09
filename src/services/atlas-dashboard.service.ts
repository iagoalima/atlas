import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  Guild,
  MessageFlags,
  TextDisplayBuilder,
} from "discord.js";
import path from "node:path";
import { prisma } from "../infrastructure/database/prisma.js";

const BANNER_PATH = path.resolve(process.cwd(), "assets/panels/dashboard.png");

function buildDashboard(): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(0x1f4f78)
    .addMediaGalleryComponents((gallery) =>
      gallery.addItems((item) => item.setURL("attachment://dashboard.png")),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent([
        "# 🪖 ATLAS — CENTRAL",
        "",
        "A central oficial para **solicitações, medalhas e acompanhamento** do sistema de condecorações.",
        "-# Exército Brasileiro • Sistema Atlas",
      ].join("\n")),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent([
        "## 🎖️ Solicitações",
        "",
        "Inicie uma nova solicitação, escolha de **1 a 3 medalhas** e acompanhe todo o processo de análise.",
        "",
        "## 🏅 Catálogo",
        "",
        "Consulte as medalhas disponíveis, seus requisitos, jurisprudências e responsáveis autorizados.",
        "",
        "## 🔐 Segurança e rastreabilidade",
        "",
        "Cada decisão, aprovação e entrega é registrada pelo Atlas para manter o processo organizado e auditável.",
      ].join("\n")),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("atlas_dashboard_requests").setLabel("Solicitar medalhas").setEmoji("🎖️").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("atlas_dashboard_catalog").setLabel("Ver catálogo").setEmoji("🏅").setStyle(ButtonStyle.Secondary),
      ),
    );
}

export async function createAtlasDashboard(guild: Guild, channelId: string): Promise<string> {
  const channel = await guild.channels.fetch(channelId);
  if (!channel?.isTextBased() || !channel.isSendable()) throw new Error("Canal do dashboard não encontrado ou sem permissão para envio.");

  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: guild.id } });
  if (!config) throw new Error("O servidor ainda não possui configuração do Atlas.");

  const payload = {
    components: [buildDashboard()],
    files: [{ attachment: BANNER_PATH, name: "dashboard.png" }],
    flags: MessageFlags.IsComponentsV2,
  };

  if (config.dashboardMessageId) {
    const existing = await channel.messages.fetch(config.dashboardMessageId).catch(() => null);
    if (existing) {
      await existing.edit(payload);
      await prisma.guildConfig.update({ where: { requestGuildId: guild.id }, data: { dashboardChannelId: channel.id } });
      return existing.id;
    }
  }

  const message = await channel.send(payload);
  await prisma.guildConfig.update({ where: { requestGuildId: guild.id }, data: { dashboardChannelId: channel.id, dashboardMessageId: message.id } });
  return message.id;
}
