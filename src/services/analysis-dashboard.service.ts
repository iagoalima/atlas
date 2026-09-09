import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  Guild,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from "discord.js";
import { prisma } from "../infrastructure/database/prisma.js";

export async function buildAnalysisDashboard(guild: Guild): Promise<ContainerBuilder> {
  const [pending, approved, denied, granted, tickets] = await Promise.all([
    prisma.ticketMedal.count({ where: { status: "PENDING", ticket: { requestGuildId: guild.id } } }),
    prisma.ticketMedal.count({ where: { status: "APPROVED", ticket: { requestGuildId: guild.id } } }),
    prisma.ticketMedal.count({ where: { status: "DENIED", ticket: { requestGuildId: guild.id } } }),
    prisma.ticketMedal.count({ where: { status: "GRANTED", ticket: { requestGuildId: guild.id } } }),
    prisma.ticket.findMany({
      where: { requestGuildId: guild.id, status: "OPEN" },
      include: { medals: { include: { medal: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const container = new ContainerBuilder().setAccentColor(pending > 0 ? 0xf1c40f : 0x2ecc71);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent([
    "# 🔎 ATLAS — CENTRAL DE ANÁLISE",
    "",
    "Painel interno da equipe para acompanhar solicitações que estão em processamento.",
    "-# A análise continua sendo individual por medalha e todas as decisões permanecem registradas.",
  ].join("\n")));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent([
    "## 📊 Visão geral",
    "",
    `🟡 **${pending}** medalhas pendentes de decisão`,
    `🟠 **${approved}** aprovadas aguardando entrega`,
    `🟢 **${granted}** entregues`,
    `🔴 **${denied}** negadas`,
  ].join("\n")));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent("## 📂 Solicitações em andamento"));

  if (!tickets.length) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Nenhuma solicitação aberta no momento."));
  }

  for (const ticket of tickets) {
    const pendingMedals = ticket.medals.filter((medal) => medal.status === "PENDING").length;
    const approvedMedals = ticket.medals.filter((medal) => medal.status === "APPROVED").length;
    const total = ticket.medals.length;
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent([
      `### 🎫 Solicitação #${ticket.ticketNumber}`,
      `**Solicitante:** <@${ticket.userId}> • **Roblox:** \`${ticket.robloxUsername}\``,
      `**Progresso:** ${total} medalha(s) • 🟡 ${pendingMedals} pendente(s) • 🟠 ${approvedMedals} aguardando entrega`,
      `-# Criada <t:${Math.floor(ticket.createdAt.getTime() / 1000)}:R>`,
    ].join("\n")));
    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`atlas_analysis_open:${ticket.id}`).setLabel("Abrir análise").setEmoji("🔎").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Abrir solicitação").setURL(`https://discord.com/channels/${guild.id}/${ticket.channelId}`),
    ));
    if (ticket !== tickets[tickets.length - 1]) container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  }

  return container;
}

export async function publishAnalysisDashboard(guild: Guild, channelId: string): Promise<string> {
  const channel = await guild.channels.fetch(channelId);
  if (!channel?.isTextBased() || !channel.isSendable()) throw new Error("Canal de análise não encontrado ou sem permissão para envio.");
  const container = await buildAnalysisDashboard(guild);
  const message = await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
  return message.id;
}
