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

/**
 * Renderiza o painel persistente de análise de uma solicitação sazonal.
 * Cada medalha possui seu próprio bloco de ações e as ações dependem
 * exclusivamente do status daquela medalha.
 */
export async function renderSeasonalReviewPanel(
  message: Message,
  ticketId: string
): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      medals: {
        include: {
          medal: {
            include: { category: true },
          },
        },
      },
    },
  });

  if (!ticket) return;

  const pending = ticket.medals.filter((m) => m.status === "PENDING").length;
  const approved = ticket.medals.filter((m) => m.status === "APPROVED").length;
  const denied = ticket.medals.filter((m) => m.status === "DENIED").length;
  const granted = ticket.medals.filter((m) => m.status === "GRANTED").length;

  const medalBlocks = ticket.medals
    .map((ticketMedal) => {
      const medal = ticketMedal.medal;
      const emoji = medal.emoji ? `${medal.emoji} ` : "🎖️ ";

      const status =
        ticketMedal.status === "PENDING"
          ? "🟡 **Pendente**"
          : ticketMedal.status === "APPROVED"
            ? "🟠 **Aprovada — aguardando entrega**"
            : ticketMedal.status === "DENIED"
              ? "🔴 **Negada**"
              : "🟢 **Entregue**";

      const lines = [
        `### ${emoji}${medal.name}`,
        `-# ${medal.category?.name ?? "Sem categoria"}`,
        "",
        `**Status:** ${status}`,
      ];

      if (ticketMedal.decidedBy) {
        lines.push(`**Responsável:** <@${ticketMedal.decidedBy}>`);
      }

      if (ticketMedal.reason) {
        lines.push("", `**Justificativa:** ${ticketMedal.reason}`);
      }

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
            : 0x2ecc71
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "# 🔎 Análise da solicitação",
          "",
          `👤 **Solicitante:** <@${ticket.userId}>`,
          `🎮 **Roblox:** \`${ticket.robloxUsername}\``,
          `🆔 **Solicitação:** #${ticket.ticketNumber}`,
        ].join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "## 📊 Resumo",
          "",
          `🟡 Pendentes: **${pending}**`,
          `🟠 Aprovadas aguardando entrega: **${approved}**`,
          `🟢 Entregues: **${granted}**`,
          `🔴 Negadas: **${denied}**`,
        ].join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        ["## 🏅 Medalhas", "", medalBlocks || "-# Nenhuma medalha encontrada."].join("\n")
      )
    );

  for (const ticketMedal of ticket.medals) {
    const buttons: ButtonBuilder[] = [];

    if (ticketMedal.status === "PENDING") {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`ticket_medal_approve:${ticketMedal.id}`)
          .setLabel("Aprovar")
          .setEmoji("✅")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`ticket_medal_deny:${ticketMedal.id}`)
          .setLabel("Negar")
          .setEmoji("❌")
          .setStyle(ButtonStyle.Danger),
      );
    }

    if (ticketMedal.status === "APPROVED") {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`ticket_medal_deliver:${ticketMedal.id}`)
          .setLabel("Entregar")
          .setEmoji("🎖️")
          .setStyle(ButtonStyle.Primary),
      );
    }

    buttons.push(
      new ButtonBuilder()
        .setCustomId(`ticket_medal_proofs:${ticketMedal.id}`)
        .setLabel("Visualizar provas")
        .setStyle(ButtonStyle.Secondary)
    );

    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)
    );
  }

  await message.edit({
    content: null,
    embeds: [],
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}
