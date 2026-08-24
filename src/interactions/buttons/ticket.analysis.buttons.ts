import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ContainerBuilder,
  Guild,
  Message,
  MessageFlags,
  ModalBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { prisma } from "../../infrastructure/database/prisma.js";

import {
  logAuditEvent,
} from "../../services/audit-log.service.js";

import {
  deliverMedal,
} from "../../services/medal-delivery.service.js";

// ==========================================================
// ANÁLISE DE MEDALHAS DO TICKET
// ==========================================================

export async function handleTicketAnalysisButton(
  interaction: ButtonInteraction
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: [
        "## ❌ Ação indisponível",
        "",
        "Esta ação só pode ser utilizada dentro de um servidor.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const isApprove =
    interaction.customId.startsWith(
      "ticket_medal_approve:"
    );

  const isDeny =
    interaction.customId.startsWith(
      "ticket_medal_deny:"
    );

  const isDeliver =
    interaction.customId.startsWith(
      "ticket_medal_deliver:"
    );

  if (!isApprove && !isDeny && !isDeliver) {
    return;
  }

  const medalTicketId =
    interaction.customId.split(":")[1];

  if (!medalTicketId) {
    await interaction.reply({
      content: [
        "## ❌ Solicitação inválida",
        "",
        "Não foi possível identificar a medalha desta solicitação.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const ticketMedal =
    await prisma.ticketMedal.findUnique({
      where: {
        id: medalTicketId,
      },

      include: {
        medal: {
          include: {
            category: true,
            approvalRoles: true,
            deliveryRoles: true,
          },
        },

        ticket: true,
      },
    });

  if (!ticketMedal) {
    await interaction.reply({
      content: [
        "## ❌ Medalha não encontrada",
        "",
        "Esta medalha não está mais associada a uma solicitação válida.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    ticketMedal.ticket.channelId !==
    interaction.channelId
  ) {
    await interaction.reply({
      content: [
        "## ❌ Solicitação inválida",
        "",
        "Esta medalha não pertence a este ticket.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    ticketMedal.ticket.status ===
    "CLOSED"
  ) {
    await interaction.reply({
      content: [
        "## 🔒 Ticket encerrado",
        "",
        "Este ticket já foi encerrado e não pode mais ser analisado.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const member =
    await interaction.guild.members.fetch(
      interaction.user.id
    );

  // ========================================================
  // APROVAÇÃO / NEGATIVA
  // ========================================================

  if (isApprove || isDeny) {
    const config =
      await prisma.guildConfig.findUnique({
        where: {
          requestGuildId:
            interaction.guild.id,
        },
      });

    if (!config?.staffRoleId) {
      await interaction.reply({
        content: [
          "## ⚙️ Configuração incompleta",
          "",
          "O cargo responsável pela análise das medalhas ainda não foi configurado.",
          "",
          "-# Um administrador precisa revisar o setup do Atlas.",
        ].join("\n"),
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    if (
      !member.roles.cache.has(
        config.staffRoleId
      )
    ) {
      await interaction.reply({
        content: [
          "## 🔒 Acesso restrito",
          "",
          "Apenas membros da equipe de medalhas podem analisar solicitações.",
        ].join("\n"),
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    const hasApprovalPermission =
      ticketMedal.medal.approvalRoles.some(
        (approvalRole) =>
          member.roles.cache.has(
            approvalRole.roleId
          )
      );

    if (!hasApprovalPermission) {
      await interaction.reply({
        content: [
          "## 🔒 Permissão insuficiente",
          "",
          "Você faz parte da equipe de medalhas, mas não possui permissão para aprovar ou negar esta medalha.",
          "",
          `🏅 **Medalha:** ${ticketMedal.medal.name}`,
        ].join("\n"),
        flags: MessageFlags.Ephemeral,
      });

      return;
    }
  }

  // ========================================================
  // ENTREGA
  // ========================================================

  if (isDeliver) {
    if (
      ticketMedal.status !==
      "APPROVED"
    ) {
      let statusText =
        "não está aprovada";

      if (
        ticketMedal.status ===
        "PENDING"
      ) {
        statusText =
          "ainda está pendente de análise";
      }

      if (
        ticketMedal.status ===
        "DENIED"
      ) {
        statusText =
          "foi negada";
      }

      if (
        ticketMedal.status ===
        "GRANTED"
      ) {
        statusText =
          "já foi entregue";
      }

      await interaction.reply({
        content: [
          "## ⚠️ Entrega indisponível",
          "",
          `Esta medalha ${statusText}.`,
        ].join("\n"),
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    /*
     * IMPORTANTE:
     *
     * A entrega NÃO verifica staffRoleId.
     *
     * A autorização da entrega deve vir da configuração
     * específica de permissão da medalha.
     *
     * O campo deliveryRoles representa os cargos que
     * serão CONCEDIDOS ao usuário e, portanto, não deve
     * ser utilizado como permissão de entrega.
     *
     * A função deliverMedal permanece responsável por
     * validar a permissão efetiva de entrega.
     */

    await deliverApprovedTicketMedal(
      interaction,
      interaction.guild,
      ticketMedal.id
    );

    return;
  }

  // ========================================================
  // APROVAÇÃO
  // ========================================================

  if (isApprove) {
    if (
      ticketMedal.status !==
      "PENDING"
    ) {
      await interaction.reply({
        content: [
          "## ⚠️ Medalha já analisada",
          "",
          "Esta medalha já possui uma decisão registrada.",
        ].join("\n"),
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    await approveTicketMedal(
      interaction,
      interaction.guild,
      ticketMedal.id
    );

    return;
  }

  // ========================================================
  // NEGATIVA
  // ========================================================

  if (isDeny) {
    if (
      ticketMedal.status !==
      "PENDING"
    ) {
      await interaction.reply({
        content: [
          "## ⚠️ Medalha já analisada",
          "",
          "Esta medalha já possui uma decisão registrada.",
        ].join("\n"),
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    await showDenyModal(
      interaction,
      ticketMedal.id
    );

    return;
  }
}

// ==========================================================
// APROVAR MEDALHA
// ==========================================================

async function approveTicketMedal(
  interaction: ButtonInteraction,
  guild: Guild,
  ticketMedalId: string
): Promise<void> {
  const ticketMedal =
    await prisma.ticketMedal.findUnique({
      where: {
        id: ticketMedalId,
      },

      include: {
        medal: true,
        ticket: true,
      },
    });

  if (!ticketMedal) {
    await interaction.reply({
      content: [
        "## ❌ Medalha não encontrada",
        "",
        "Não foi possível localizar esta medalha.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    ticketMedal.status !==
    "PENDING"
  ) {
    await interaction.reply({
      content: [
        "## ⚠️ Medalha já analisada",
        "",
        "Esta medalha já possui uma decisão registrada.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const approved =
    await prisma.ticketMedal.update({
      where: {
        id: ticketMedalId,
      },

      data: {
        status:
          "APPROVED",

        decidedBy:
          interaction.user.id,

        reason: null,
      },

      include: {
        medal: true,
        ticket: true,
      },
    });

  // ========================================================
  // LOG DE APROVAÇÃO
  // ========================================================

  await logAuditEvent({
    guild,

    action:
      "MEDAL_APPROVED",

    executorId:
      interaction.user.id,

    targetId:
      approved.ticket.userId,

    ticketId:
      approved.ticketId,

    medalId:
      approved.medalId,

    details: {
      ticketMedalId:
        approved.id,

      medalName:
        approved.medal.name,

      status:
        "APPROVED",

      nextStep:
        "MEDAL_DELIVERY",
    },
  });

  console.log(
    "📋 [TICKET] Log de aprovação registrado:",
    {
      ticketMedalId:
        approved.id,

      ticketId:
        approved.ticketId,

      medalId:
        approved.medalId,

      executorId:
        interaction.user.id,
    }
  );

  // ========================================================
  // ATUALIZA PAINEL
  // ========================================================

  await updateAnalysisPanel(
    interaction,
    approved.ticketId
  );

  // ========================================================
  // MENSAGEM PÚBLICA
  // ========================================================

  const approvalContainer =
    new ContainerBuilder()
      .setAccentColor(
        0x2ecc71
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              "# ✅ Medalha aprovada",
              "",
              `🏅 **${approved.medal.name}**`,
              "",
              "A solicitação foi analisada e aprovada com sucesso.",
            ].join("\n")
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              "## 👤 Responsável",
              "",
              `<@${interaction.user.id}>`,
            ].join("\n")
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              "## 🟠 Próxima etapa",
              "",
              "A medalha está aprovada e aguardando a entrega efetiva no servidor do EB.",
              "",
              "-# A aprovação não concede o cargo automaticamente.",
              "-# A entrega será registrada somente após o cargo ser efetivamente concedido.",
            ].join("\n")
          )
      );

  await interaction.reply({
    components: [
      approvalContainer,
    ],

    flags:
      MessageFlags.IsComponentsV2,
  });

  console.log(
    "✅ [TICKET] Medalha aprovada:",
    {
      ticketMedalId:
        approved.id,

      ticketId:
        approved.ticketId,

      medalId:
        approved.medalId,

      executorId:
        interaction.user.id,
    }
  );
}

// ==========================================================
// ENTREGAR MEDALHA APROVADA
// ==========================================================

async function deliverApprovedTicketMedal(
  interaction: ButtonInteraction,
  guild: Guild,
  ticketMedalId: string
): Promise<void> {
  const ticketMedal =
    await prisma.ticketMedal.findUnique({
      where: {
        id: ticketMedalId,
      },

      include: {
        medal: true,
        ticket: true,
      },
    });

  if (!ticketMedal) {
    await interaction.reply({
      content: [
        "## ❌ Medalha não encontrada",
        "",
        "Não foi possível localizar esta medalha.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    ticketMedal.status !==
    "APPROVED"
  ) {
    await interaction.reply({
      content: [
        "## ⚠️ Entrega indisponível",
        "",
        "Somente medalhas aprovadas podem ser entregues.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  let deliveryResult;

  try {
    deliveryResult =
      await deliverMedal({
        client:
          interaction.client,

        ticketMedalId:
          ticketMedal.id,

        executorId:
          interaction.user.id,

        requestGuildId:
          guild.id,
      });
  } catch (error) {
    console.error(
      "❌ [TICKET] Falha na entrega da medalha:",
      {
        ticketMedalId:
          ticketMedal.id,

        ticketId:
          ticketMedal.ticketId,

        medalId:
          ticketMedal.medalId,

        executorId:
          interaction.user.id,

        error,
      }
    );

    await interaction.reply({
      content: [
        "## ⚠️ Entrega não concluída",
        "",
        `🏅 **${ticketMedal.medal.name}** continua aprovada.`,
        "",
        "O Atlas não conseguiu concluir a entrega no servidor do EB.",
        "",
        "Nenhum registro de concessão foi criado para esta tentativa.",
        "",
        "-# O status permanece como **APPROVED** para permitir uma nova tentativa.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const pendingCount =
    await prisma.ticketMedal.count({
      where: {
        ticketId:
          ticketMedal.ticketId,

        status:
          "PENDING",
      },
    });

  const approvedCount =
    await prisma.ticketMedal.count({
      where: {
        ticketId:
          ticketMedal.ticketId,

        status:
          "APPROVED",
      },
    });

  const grantedCount =
    await prisma.ticketMedal.count({
      where: {
        ticketId:
          ticketMedal.ticketId,

        status:
          "GRANTED",
      },
    });

  await updateAnalysisPanel(
    interaction,
    ticketMedal.ticketId
  );

  await interaction.reply({
    content: [
      "## 🏅 Medalha entregue",
      "",
      `**${ticketMedal.medal.name}** foi entregue com sucesso no servidor do EB.`,
      "",
      `👤 **Responsável:** <@${interaction.user.id}>`,
      "",
      deliveryResult.addedRoleIds.length > 0
        ? `🎖️ **Cargos adicionados:** ${deliveryResult.addedRoleNames
            .map(
              (name) =>
                `\`${name}\``
            )
            .join(", ")}`
        : "🎖️ O usuário já possuía todos os cargos desta medalha.",
      "",
      deliveryResult.alreadyHadRoleIds.length > 0
        ? `ℹ️ **Cargos que já possuía:** ${deliveryResult.alreadyHadRoleNames
            .map(
              (name) =>
                `\`${name}\``
            )
            .join(", ")}`
        : "",
      "",
      `📊 **Progresso:** ${grantedCount} entregue(s) • ${approvedCount} aprovada(s) aguardando entrega • ${pendingCount} pendente(s)`,
      "",
      pendingCount > 0
        ? "🟡 Ainda existem medalhas aguardando análise."
        : approvedCount > 0
          ? "🟠 Ainda existem medalhas aprovadas aguardando entrega."
          : "🟢 Todas as medalhas foram processadas.",
    ]
      .filter(Boolean)
      .join("\n"),

    flags:
      MessageFlags.Ephemeral,
  });

  console.log(
    "🏅 [TICKET] Entrega concluída:",
    {
      ticketMedalId:
        ticketMedal.id,

      ticketId:
        ticketMedal.ticketId,

      medalId:
        ticketMedal.medalId,

      medalName:
        ticketMedal.medal.name,

      executorId:
        interaction.user.id,

      addedRoles:
        deliveryResult.addedRoleNames,

      alreadyHadRoles:
        deliveryResult.alreadyHadRoleNames,
    }
  );
}

// ==========================================================
// MODAL DE NEGATIVA
// ==========================================================

async function showDenyModal(
  interaction: ButtonInteraction,
  ticketMedalId: string
): Promise<void> {
  const modal =
    new ModalBuilder()
      .setCustomId(
        `ticket_medal_deny_modal:${ticketMedalId}`
      )
      .setTitle(
        "Negar medalha"
      );

  const reasonInput =
    new TextInputBuilder()
      .setCustomId(
        "deny_reason"
      )
      .setLabel(
        "Justificativa da negativa"
      )
      .setPlaceholder(
        "Informe o motivo pelo qual esta medalha não foi aprovada..."
      )
      .setStyle(
        TextInputStyle.Paragraph
      )
      .setRequired(true)
      .setMinLength(5)
      .setMaxLength(1000);

  const row =
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        reasonInput
      );

  modal.addComponents(
    row
  );

  await interaction.showModal(
    modal
  );
}

// ==========================================================
// ATUALIZA PAINEL DE ANÁLISE
// ==========================================================

export async function updateAnalysisPanel(
  interaction: {
    message: Message;
  },
  ticketId: string
): Promise<void> {
  const ticket =
    await prisma.ticket.findUnique({
      where: {
        id: ticketId,
      },

      include: {
        medals: {
          include: {
            medal: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

  if (!ticket) {
    return;
  }

  const pending =
    ticket.medals.filter(
      (item) =>
        item.status ===
        "PENDING"
    ).length;

  const approved =
    ticket.medals.filter(
      (item) =>
        item.status ===
        "APPROVED"
    ).length;

  const denied =
    ticket.medals.filter(
      (item) =>
        item.status ===
        "DENIED"
    ).length;

  const granted =
    ticket.medals.filter(
      (item) =>
        item.status ===
        "GRANTED"
    ).length;

  const medalBlocks =
    ticket.medals
      .map(
        (
          ticketMedal
        ) => {
          const medal =
            ticketMedal.medal;

          const emoji =
            medal.emoji
              ? `${medal.emoji} `
              : "🎖️ ";

          let status =
            "🟡 **Pendente**";

          if (
            ticketMedal.status ===
            "APPROVED"
          ) {
            status =
              "🟠 **Aprovada — aguardando entrega**";
          }

          if (
            ticketMedal.status ===
            "DENIED"
          ) {
            status =
              "🔴 **Negada**";
          }

          if (
            ticketMedal.status ===
            "GRANTED"
          ) {
            status =
              "🟢 **Entregue**";
          }

          const components = [
            `### ${emoji}${medal.name}`,
            `-# ${medal.category?.name ?? "Sem categoria"}`,
            "",
            `**Status:** ${status}`,
          ];

          if (
            ticketMedal.decidedBy
          ) {
            components.push(
              `**Responsável:** <@${ticketMedal.decidedBy}>`
            );
          }

          if (
            ticketMedal.reason
          ) {
            components.push(
              "",
              `**Justificativa:** ${ticketMedal.reason}`
            );
          }

          return components.join(
            "\n"
          );
        }
      )
      .join("\n\n");

  const container =
    new ContainerBuilder()
      .setAccentColor(
        pending > 0
          ? 0xf1c40f
          : approved > 0
            ? 0xe67e22
            : denied > 0 &&
                granted === 0
              ? 0xe74c3c
              : 0x2ecc71
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              "# 🔎 Análise da solicitação",
              "",
              `👤 **Solicitante:** <@${ticket.userId}>`,
              `🎮 **Roblox:** \`${ticket.robloxUsername}\``,
            ].join("\n")
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
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
        new SeparatorBuilder()
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              "## 🏅 Medalhas",
              "",
              medalBlocks ||
                "-# Nenhuma medalha encontrada.",
            ].join("\n")
          )
      );

  for (
    const ticketMedal of
    ticket.medals
  ) {
    if (
      ticketMedal.status ===
      "PENDING"
    ) {
      const approveButton =
        new ButtonBuilder()
          .setCustomId(
            `ticket_medal_approve:${ticketMedal.id}`
          )
          .setLabel(
            `Aprovar ${ticketMedal.medal.name}`.slice(
              0,
              80
            )
          )
          .setEmoji("✅")
          .setStyle(
            ButtonStyle.Success
          );

      const denyButton =
        new ButtonBuilder()
          .setCustomId(
            `ticket_medal_deny:${ticketMedal.id}`
          )
          .setLabel(
            `Negar ${ticketMedal.medal.name}`.slice(
              0,
              80
            )
          )
          .setEmoji("❌")
          .setStyle(
            ButtonStyle.Danger
          );

      const row =
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            approveButton,
            denyButton
          );

      container.addActionRowComponents(
        row
      );
    }

    if (
      ticketMedal.status ===
      "APPROVED"
    ) {
      const deliverButton =
        new ButtonBuilder()
          .setCustomId(
            `ticket_medal_deliver:${ticketMedal.id}`
          )
          .setLabel(
            `Entregar ${ticketMedal.medal.name}`.slice(
              0,
              80
            )
          )
          .setEmoji("🎖️")
          .setStyle(
            ButtonStyle.Primary
          );

      const row =
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            deliverButton
          );

      container.addActionRowComponents(
        row
      );
    }
  }

  try {
    await interaction.message.edit({
      content: null,

      embeds: [],

      components: [
        container,
      ],

      flags:
        MessageFlags.IsComponentsV2,
    });
  } catch (error) {
    console.error(
      "❌ [TICKET] Erro ao atualizar painel de análise:",
      error
    );
  }
}