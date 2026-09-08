import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  Message,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from "discord.js";

import { prisma } from "../infrastructure/database/prisma.js";

function medalButtonLabel(action: "approve" | "deny" | "deliver" | "proofs", medalName: string): string {
  const prefix = {
    approve: "Aprovar medalha",
    deny: "Negar medalha",
    deliver: "Entregar medalha",
    proofs: "Visualizar provas",
  }[action];

  const suffix = ` ${medalName}`;
  const maxLength = 80;
  return `${prefix}${suffix}`.slice(0, maxLength);
}

export async function renderSeasonalReviewPanel(message: Message, ticketId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      medals: {
        include: { medal: { include: { category: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!ticket) return;

  const pending = ticket.medals.filter((m) => m.status === "PENDING").length;
  const approved = ticket.medals.filter((m) => m.status === "APPROVED").length;
  const denied = ticket.medals.filter((m) => m.status === "DENIED").length;
  const granted = ticket.medals.filter((m) => m.status === "GRANTED").length;

  const medalBlocks = ticket.medals
    .map((tm, index) => {
      const status =
        tm.status === "PENDING"
          ? "🟡 **Pendente**"
          : tm.status === "APPROVED"
            ? "🟠 **Aprovada — aguardando entrega**"
            : tm.status === "DENIED"
              ? "🔴 **Negada**"
              : "🟢 **Entregue**";

      const lines = [
        `### ${index + 1}. ${tm.medal.emoji ? `${tm.medal.emoji} ` : "🎖️ "}${tm.medal.name}`,
        `-# ${tm.medal.category?.name ?? "Sem categoria"}`,
        "",
        `**Status:** ${status}`,
      ];

      if (tm.decidedBy) lines.push(`**Responsável:** <@${tm.decidedBy}>`);
      if (tm.reason) lines.push("", `**Justificativa:** ${tm.reason}`);

      return lines.join("\n");
    })
    .join("\n\n");

  const container = new ContainerBuilder()
    .setAccentColor(
      pending > 0
        ? 0xf1c40f
        : approved > 0
          ? 0xe67e22
          : denied > 0 && granted === 0
            ? 0xe74c3c
            : 0x2ecc71,
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "# 🔎 Análise da solicitação",
          "",
          `👤 **Solicitante:** <@${ticket.userId}>`,
          `🎮 **Roblox:** \`${ticket.robloxUsername}\``,
          `🆔 **Solicitação:** #${ticket.ticketNumber}`,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "## 📊 Resumo",
          "",
          `🟡 Pendentes: **${pending}**`,
          `🟠 Aprovadas aguardando entrega: **${approved}**`,
          `🟢 Entregues: **${granted}**`,
          `🔴 Negadas: **${denied}**`,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(["## 🏅 Medalhas", "", medalBlocks || "-# Nenhuma medalha encontrada."].join("\n")),
    );

  for (const tm of ticket.medals) {
    const medalName = tm.medal.name;
    const buttons: ButtonBuilder[] = [];

    if (tm.status === "PENDING") {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`ticket_medal_approve:${tm.id}`)
          .setLabel(medalButtonLabel("approve", medalName))
          .setEmoji("✅")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`ticket_medal_deny:${tm.id}`)
          .setLabel(medalButtonLabel("deny", medalName))
          .setEmoji("❌")
          .setStyle(ButtonStyle.Danger),
      );
    } else if (tm.status === "APPROVED") {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`ticket_medal_deliver:${tm.id}`)
          .setLabel(medalButtonLabel("deliver", medalName))
          .setEmoji("🎖️")
          .setStyle(ButtonStyle.Primary),
      );
    }

    buttons.push(
      new ButtonBuilder()
        .setCustomId(`ticket_medal_proofs:${tm.id}`)
        .setLabel(medalButtonLabel("proofs", medalName))
        .setStyle(ButtonStyle.Secondary),
    );

    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons));
  }

  await message.edit({ content: null, embeds: [], components: [container], flags: MessageFlags.IsComponentsV2 });
}

export async function refreshLatestSeasonalReviewPanel(
  client: Message["client"],
  ticketId: string,
  channelId: string,
): Promise<void> {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || !channel.isSendable()) return;

  const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  const panel = messages?.find(
    (message) => message.author.id === client.user?.id && message.components.length > 0,
  );

  if (panel) await renderSeasonalReviewPanel(panel, ticketId);
}
