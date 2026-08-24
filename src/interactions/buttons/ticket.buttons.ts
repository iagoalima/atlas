import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import {
  deliverMedal,
} from "../../services/medal-delivery.service.js";

import {
  createTicketTranscript,
} from "../../services/transcript.service.js";

import {
  logAuditEvent,
} from "../../services/audit-log.service.js";

import { prisma } from "../../infrastructure/database/prisma.js";

// ==========================================================
// CONTROLE DE CRIAÇÃO DE TICKETS
// ==========================================================

const ticketCreationLocks = new Set<string>();

// ==========================================================
// BOTÕES DE TICKET
// ==========================================================

export async function handleTicketButton(
  interaction: ButtonInteraction
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content:
        "❌ Esta ação só pode ser utilizada dentro de um servidor.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // ABRIR TICKET
  // ========================================================

  if (
    interaction.customId === "ticket_open" ||
    interaction.customId === "ticket_request_medals"
  ) {
    await handleTicketOpen(interaction);
    return;
  }

  // ========================================================
  // CONFIRMAR MEDALHAS
  // ========================================================

  if (
    interaction.customId.startsWith(
      "ticket_medal_confirm:"
    )
  ) {
    await handleTicketMedalConfirm(interaction);
    return;
  }

  // ========================================================
  // VOLTAR PARA SELEÇÃO
  // ========================================================

  if (
    interaction.customId.startsWith(
      "ticket_medal_back:"
    )
  ) {
    await handleTicketMedalBack(interaction);
    return;
  }

  // ========================================================
  // APROVAR MEDALHA
  // ========================================================

  if (
    interaction.customId.startsWith(
      "ticket_medal_approve:"
    )
  ) {
    await handleTicketMedalApprove(interaction);
    return;
  }

  // ========================================================
  // NEGAR MEDALHA
  // ========================================================

  if (
    interaction.customId.startsWith(
      "ticket_medal_deny:"
    )
  ) {
    await handleTicketMedalDeny(interaction);
    return;
  }

  // ========================================================
  // ENTREGAR MEDALHA
  // ========================================================

  if (
    interaction.customId.startsWith(
      "ticket_medal_deliver:"
    )
  ) {
    await handleTicketMedalDeliver(interaction);
    return;
  }

  // ========================================================
  // FECHAR TICKET
  // ========================================================

  if (interaction.customId === "ticket_close") {
    await handleTicketClose(interaction);
    return;
  }

  // ========================================================
  // DELETAR TICKET
  // ========================================================

  if (interaction.customId === "ticket_delete") {
    await handleTicketDelete(interaction);
    return;
  }

  // ========================================================
  // FORÇAR ENCERRAMENTO
  // ========================================================

  if (
    interaction.customId.startsWith(
      "ticket_force_close:"
    )
  ) {
    await handleTicketForceClose(interaction);
    return;
  }

  console.log(
    "⚠️ [TICKET] Botão não reconhecido:",
    interaction.customId
  );
}

// ==========================================================
// ABERTURA DO TICKET
// ==========================================================

async function handleTicketOpen(
  interaction: ButtonInteraction
): Promise<void> {
  if (!interaction.guild) {
    return;
  }

  const config =
    await prisma.guildConfig.findUnique({
      where: {
        requestGuildId: interaction.guild.id,
      },
    });

  if (!config) {
    await interaction.reply({
      content:
        "❌ **O sistema de tickets ainda não foi configurado.**\n\nUm administrador precisa concluir a configuração do Atlas antes que novas solicitações possam ser abertas.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (!config.ticketCategoryId) {
    await interaction.reply({
      content:
        "❌ **A categoria dos tickets ainda não foi configurada.**",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const existingTicket =
    await prisma.ticket.findFirst({
      where: {
        userId: interaction.user.id,
        status: "OPEN",
      },
    });

  if (existingTicket) {
    const existingChannel =
      interaction.guild.channels.cache.get(
        existingTicket.channelId
      );

    if (existingChannel) {
      await interaction.reply({
        content: [
          "⚠️ **Você já possui uma solicitação em andamento.**",
          "",
          `🎫 ${existingChannel}`,
          "",
          "-# Finalize a solicitação atual antes de abrir uma nova.",
        ].join("\n"),
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    await prisma.ticket.update({
      where: {
        id: existingTicket.id,
      },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
      },
    });
  }

  const medals =
    await prisma.medal.findMany({
      where: {
        active: true,
      },
      include: {
        category: true,
      },
      orderBy: [
        {
          category: {
            position: "asc",
          },
        },
        {
          name: "asc",
        },
      ],
    });

  if (medals.length === 0) {
    await interaction.reply({
      content: [
        "❌ **Nenhuma medalha disponível.**",
        "",
        "No momento não existem medalhas disponíveis para solicitação.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const medalSelect =
    new StringSelectMenuBuilder()
      .setCustomId(
        `ticket_medal_select:${interaction.user.id}`
      )
      .setPlaceholder(
        "Selecione as medalhas que deseja solicitar"
      )
      .setMinValues(1)
      .setMaxValues(
        Math.min(3, medals.length)
      );

  for (const medal of medals) {
    const option =
      new StringSelectMenuOptionBuilder()
        .setLabel(
          medal.name.slice(0, 100)
        )
        .setValue(medal.id);

    if (medal.emoji) {
      option.setEmoji(medal.emoji);
    }

    if (medal.category?.name) {
      option.setDescription(
        medal.category.name.slice(0, 100)
      );
    }

    medalSelect.addOptions(option);
  }

  const row =
    new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(medalSelect);

  await interaction.reply({
    content: [
      "## 🎖️ Solicitação de medalhas",
      "",
      "Selecione abaixo as medalhas que deseja solicitar.",
      "",
      "┌ **Limite da solicitação**",
      "└ Você pode solicitar **de 1 a 3 medalhas** por ticket.",
      "",
      "-# Cada medalha será analisada individualmente pela equipe responsável.",
    ].join("\n"),
    components: [row],
    flags: MessageFlags.Ephemeral,
  });

  console.log(
    "🎖️ [TICKET] Seleção de medalhas enviada para:",
    interaction.user.tag
  );
}

// ==========================================================
// CONFIRMAÇÃO DAS MEDALHAS
// ==========================================================

async function handleTicketMedalConfirm(
  interaction: ButtonInteraction
): Promise<void> {
  if (!interaction.guild) {
    return;
  }

  const parts =
    interaction.customId.split(":");

  const userId = parts[1];
  const medalIdsString = parts[2];

  if (!userId || !medalIdsString) {
    await interaction.reply({
      content:
        "❌ Não foi possível identificar esta solicitação.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content:
        "❌ Esta solicitação pertence a outro usuário.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (ticketCreationLocks.has(interaction.user.id)) {
    await interaction.reply({
      content: [
        "⏳ **Sua solicitação já está sendo criada.**",
        "",
        "Aguarde alguns segundos.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  ticketCreationLocks.add(interaction.user.id);

  try {
    const medalIds =
      medalIdsString
        .split(",")
        .filter(Boolean);

    if (
      medalIds.length < 1 ||
      medalIds.length > 3
    ) {
      await interaction.reply({
        content:
          "❌ A solicitação deve conter entre **1 e 3 medalhas**.",
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    const uniqueMedalIds =
      [...new Set(medalIds)];

    if (
      uniqueMedalIds.length !==
      medalIds.length
    ) {
      await interaction.reply({
        content:
          "❌ Foram detectadas medalhas duplicadas na solicitação.",
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    const config =
      await prisma.guildConfig.findUnique({
        where: {
          requestGuildId:
            interaction.guild.id,
        },
      });

    if (!config) {
      await interaction.reply({
        content:
          "❌ O sistema de tickets não está configurado neste servidor.",
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    if (
      !config.ticketCategoryId ||
      !config.staffRoleId
    ) {
      await interaction.reply({
        content:
          "❌ A configuração do sistema de tickets está incompleta.",
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    const existingTicket =
      await prisma.ticket.findFirst({
        where: {
          userId: interaction.user.id,
          status: "OPEN",
        },
      });

    if (existingTicket) {
      const existingChannel =
        interaction.guild.channels.cache.get(
          existingTicket.channelId
        );

      if (existingChannel) {
        await interaction.update({
          content: [
            "⚠️ **Solicitação já existente**",
            "",
            "Você já possui uma solicitação em andamento.",
            "",
            `🎫 ${existingChannel}`,
            "",
            "-# Não é possível criar duas solicitações simultaneamente.",
          ].join("\n"),
          components: [],
        });

        return;
      }

      await prisma.ticket.update({
        where: {
          id: existingTicket.id,
        },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
        },
      });
    }

    const medals =
      await prisma.medal.findMany({
        where: {
          id: {
            in: uniqueMedalIds,
          },
          active: true,
        },
        include: {
          category: true,
        },
      });

    if (
      medals.length !==
      uniqueMedalIds.length
    ) {
      await interaction.reply({
        content: [
          "❌ **Uma ou mais medalhas não estão mais disponíveis.**",
          "",
          "Volte à seleção e escolha novamente as medalhas disponíveis.",
        ].join("\n"),
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    await interaction.deferUpdate();

    let channelId: string | null = null;
    let ticketId: string | null = null;

    try {
      const member =
        await interaction.guild.members.fetch(
          interaction.user.id
        );

      const ticket =
        await prisma.ticket.create({
          data: {
            channelId: "CREATING",
            userId:
              interaction.user.id,
            username:
              interaction.user.username,
            nickname:
              member.nickname ?? null,
            robloxUsername:
              "PENDENTE",
            status: "OPEN",
          },
        });

      ticketId = ticket.id;

      const channelName =
        `medalha-${ticket.ticketNumber}`;

      const channel =
        await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent:
            config.ticketCategoryId,
          topic:
            `Solicitação de medalhas • Ticket #${ticket.ticketNumber}`,
          permissionOverwrites: [
            {
              id: interaction.guild.roles.everyone.id,
              deny: [
                PermissionFlagsBits.ViewChannel,
              ],
            },
            {
              id: interaction.client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ManageChannels,
              ],
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
              ],
            },
            {
              id: config.staffRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
              ],
            },
            ...(config.responsibleRoleId
              ? [
                {
                  id: config.responsibleRoleId,
                  allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks,
                  ],
                },
              ]
              : []),
          ],
        });

      channelId = channel.id;

      await prisma.ticket.update({
        where: {
          id: ticket.id,
        },
        data: {
          channelId: channel.id,
        },
      });

      await prisma.ticketMedal.createMany({
        data: uniqueMedalIds.map(
          (medalId) => ({
            ticketId:
              ticket.id,
            medalId,
            status:
              "PENDING",
          })
        ),
      });

      const orderedMedals =
        uniqueMedalIds
          .map(
            (id) =>
              medals.find(
                (medal) =>
                  medal.id === id
              )
          )
          .filter(
            (
              medal
            ): medal is NonNullable<
              typeof medal
            > =>
              Boolean(medal)
          );

      const medalList =
        orderedMedals
          .map(
            (medal, index) => {
              const emoji =
                medal.emoji
                  ? `${medal.emoji} `
                  : "🎖️ ";

              return [
                `**${index + 1}.** ${emoji}${medal.name}`,
                `-# ${medal.category?.name ?? "Sem categoria"}`,
              ].join("\n");
            }
          )
          .join("\n\n");

      const closeButton =
        new ButtonBuilder()
          .setCustomId(
            "ticket_close"
          )
          .setLabel(
            "Encerrar ticket"
          )
          .setEmoji("🔒")
          .setStyle(
            ButtonStyle.Secondary
          );

      const forceCloseButton =
        new ButtonBuilder()
          .setCustomId(
            `ticket_force_close:${ticket.id}`
          )
          .setLabel(
            "Solicitar encerramento forçado"
          )
          .setEmoji("⚠️")
          .setStyle(
            ButtonStyle.Danger
          );

      const container =
        new ContainerBuilder()
          .setAccentColor(
            0x3498db
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder()
              .setContent(
                [
                  "# 🎖️ Solicitação de Medalhas",
                  `### Ticket #${ticket.ticketNumber}`,
                  "",
                  `👤 **Solicitante:** <@${interaction.user.id}>`,
                  `🎮 **Roblox:** \`${"PENDENTE"}\``,
                  "",
                  `👥 **Equipe responsável:** <@&${config.staffRoleId}>`,
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
                  "## 🏅 Medalhas solicitadas",
                  "",
                  medalList,
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
                  "## 📎 Envio das provas",
                  "",
                  "Sua solicitação foi registrada com sucesso.",
                  "",
                  "Envie **neste canal** todas as provas necessárias para comprovar o direito às medalhas solicitadas.",
                  "",
                  "📸 Imagens",
                  "🎥 Vídeos",
                  "📄 Documentos",
                  "",
                  "-# Após o envio das provas, a equipe responsável realizará a análise.",
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
                  "## 🟡 Status",
                  "",
                  "**Aguardando provas**",
                  "",
                  "-# O ticket permanecerá aguardando enquanto as provas não forem enviadas.",
                ].join("\n")
              )
          )
          .addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                closeButton,
                forceCloseButton
              )
          );

      await channel.send({
        components: [
          container,
        ],
        flags:
          MessageFlags.IsComponentsV2,
      });

      await interaction.editReply({
        content: [
          "## ✅ Solicitação criada",
          "",
          `🎫 **Ticket:** ${channel}`,
          `🔢 **Número:** #${ticket.ticketNumber}`,
          "",
          "Sua solicitação foi criada com sucesso.",
          "",
          "### 📎 Próximo passo",
          "",
          "Acesse o ticket e envie todas as provas necessárias.",
          "",
          "-# A equipe responsável analisará sua solicitação após o envio das provas.",
        ].join("\n"),
        components: [],
      });

      console.log(
        "🎫 [TICKET] Ticket criado:",
        {
          ticketId:
            ticket.id,
          ticketNumber:
            ticket.ticketNumber,
          channelId:
            channel.id,
          userId:
            interaction.user.id,
          medalIds:
            uniqueMedalIds,
        }
      );
    } catch (error) {
      console.error(
        "❌ [TICKET] Erro ao criar ticket:",
        error
      );

      if (ticketId) {
        try {
          await prisma.ticket.delete({
            where: {
              id: ticketId,
            },
          });
        } catch (cleanupError) {
          console.error(
            "❌ [TICKET] Erro ao limpar ticket:",
            cleanupError
          );
        }
      }

      if (channelId) {
        try {
          const channel =
            interaction.guild.channels.cache.get(
              channelId
            );

          if (channel) {
            await channel.delete(
              "Falha durante a criação do ticket"
            );
          }
        } catch (cleanupError) {
          console.error(
            "❌ [TICKET] Erro ao remover canal:",
            cleanupError
          );
        }
      }

      await interaction.editReply({
        content: [
          "## ❌ Não foi possível criar sua solicitação",
          "",
          "O Atlas encontrou um erro ao criar o ticket.",
          "",
          "-# Nenhuma solicitação foi mantida parcialmente.",
          "-# Tente novamente em alguns instantes.",
        ].join("\n"),
        components: [],
      });
    }
  } finally {
    ticketCreationLocks.delete(
      interaction.user.id
    );
  }
}

// ==========================================================
// VOLTAR PARA SELEÇÃO
// ==========================================================

async function handleTicketMedalBack(
  interaction: ButtonInteraction
): Promise<void> {
  if (!interaction.guild) {
    return;
  }

  const parts =
    interaction.customId.split(":");

  const userId = parts[1];

  if (
    !userId ||
    interaction.user.id !== userId
  ) {
    await interaction.reply({
      content:
        "❌ Este menu pertence a outro usuário.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const medals =
    await prisma.medal.findMany({
      where: {
        active: true,
      },
      include: {
        category: true,
      },
      orderBy: [
        {
          category: {
            position: "asc",
          },
        },
        {
          name: "asc",
        },
      ],
    });

  if (medals.length === 0) {
    await interaction.update({
      content: [
        "❌ **Nenhuma medalha disponível.**",
        "",
        "No momento não existem medalhas disponíveis para solicitação.",
      ].join("\n"),
      components: [],
    });

    return;
  }

  const medalSelect =
    new StringSelectMenuBuilder()
      .setCustomId(
        `ticket_medal_select:${interaction.user.id}`
      )
      .setPlaceholder(
        "Selecione as medalhas que deseja solicitar"
      )
      .setMinValues(1)
      .setMaxValues(
        Math.min(3, medals.length)
      );

  for (const medal of medals) {
    const option =
      new StringSelectMenuOptionBuilder()
        .setLabel(
          medal.name.slice(0, 100)
        )
        .setValue(medal.id);

    if (medal.emoji) {
      option.setEmoji(medal.emoji);
    }

    if (medal.category?.name) {
      option.setDescription(
        medal.category.name.slice(0, 100)
      );
    }

    medalSelect.addOptions(option);
  }

  const row =
    new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(medalSelect);

  await interaction.update({
    content: [
      "## 🎖️ Solicitação de medalhas",
      "",
      "Selecione novamente as medalhas que deseja solicitar.",
      "",
      "┌ **Limite da solicitação**",
      "└ Você pode solicitar **de 1 a 3 medalhas** por ticket.",
    ].join("\n"),
    components: [
      row,
    ],
  });
}

// ==========================================================
// VALIDA EQUIPE
// ==========================================================

async function validateStaffMember(
  interaction: ButtonInteraction
): Promise<boolean> {
  if (!interaction.guild) {
    return false;
  }

  const config =
    await prisma.guildConfig.findUnique({
      where: {
        requestGuildId:
          interaction.guild.id,
      },
    });

  if (!config?.staffRoleId) {
    await interaction.reply({
      content:
        "❌ A equipe de medalhas não está configurada.",
      flags: MessageFlags.Ephemeral,
    });

    return false;
  }

  const member =
    await interaction.guild.members.fetch(
      interaction.user.id
    );

  if (
    !member.roles.cache.has(
      config.staffRoleId
    )
  ) {
    await interaction.reply({
      content:
        "❌ Apenas membros da equipe de medalhas podem realizar esta ação.",
      flags: MessageFlags.Ephemeral,
    });

    return false;
  }

  return true;
}

// ==========================================================
// VALIDA RESPONSÁVEL
// ==========================================================

async function validateResponsibleMember(
  interaction: ButtonInteraction
): Promise<boolean> {
  if (!interaction.guild) {
    return false;
  }

  const config =
    await prisma.guildConfig.findUnique({
      where: {
        requestGuildId:
          interaction.guild.id,
      },
    });

  if (!config?.responsibleRoleId) {
    await interaction.reply({
      content:
        "❌ O cargo de responsáveis pelo setor não está configurado.",
      flags: MessageFlags.Ephemeral,
    });

    return false;
  }

  const member =
    await interaction.guild.members.fetch(
      interaction.user.id
    );

  if (
    !member.roles.cache.has(
      config.responsibleRoleId
    )
  ) {
    await interaction.reply({
      content: [
        "❌ **Permissão insuficiente.**",
        "",
        "Apenas os **responsáveis pelo setor** podem realizar esta ação.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return false;
  }

  return true;
}

// ==========================================================
// APROVAR MEDALHA
// ==========================================================

async function handleTicketMedalApprove(
  interaction: ButtonInteraction
): Promise<void> {
  if (!interaction.guild) {
    return;
  }

  const medalId =
    interaction.customId.split(":")[1];

  if (!medalId) {
    await interaction.reply({
      content:
        "❌ Não foi possível identificar a medalha.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    !(await validateStaffMember(interaction))
  ) {
    return;
  }

  const ticketMedal =
    await prisma.ticketMedal.findUnique({
      where: {
        id: medalId,
      },
      include: {
        medal: {
          include: {
            category: true,
          },
        },
        ticket: true,
      },
    });

  if (!ticketMedal) {
    await interaction.reply({
      content:
        "❌ Esta solicitação de medalha não foi encontrada.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    ticketMedal.ticket.channelId !==
    interaction.channelId
  ) {
    await interaction.reply({
      content:
        "❌ Esta medalha não pertence a este ticket.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    ticketMedal.status !==
    "PENDING"
  ) {
    await interaction.reply({
      content:
        "⚠️ Esta medalha já foi analisada.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  await prisma.ticketMedal.update({
    where: {
      id: ticketMedal.id,
    },
    data: {
      status: "APPROVED",
      decidedBy:
        interaction.user.id,
      reason: null,
    },
  });

  // ========================================================
  // AUDITORIA — APROVAÇÃO
  // ========================================================

  await logAuditEvent({
    guild:
      interaction.guild,
    action:
      "MEDAL_APPROVED",
    executorId:
      interaction.user.id,
    targetId:
      ticketMedal.ticket.userId,
    ticketId:
      ticketMedal.ticket.id,
    medalId:
      ticketMedal.medalId,
    details: {
      medalName:
        ticketMedal.medal.name,
      status:
        "APPROVED",
      deliveryPending:
        true,
    },
  });

  await interaction.reply({
    content: [
      "## ✅ Medalha aprovada",
      "",
      `🎖️ **${ticketMedal.medal.name}** foi aprovada com sucesso.`,
      "",
      `👤 **Responsável:** <@${interaction.user.id}>`,
      "",
      "-# A medalha agora está aguardando a entrega no servidor EB.",
    ].join("\n"),
    flags: MessageFlags.Ephemeral,
  });

  await refreshTicketPanel(
    interaction,
    ticketMedal.ticket.id
  );
}

// ==========================================================
// NEGAR MEDALHA
// ==========================================================

async function handleTicketMedalDeny(
  interaction: ButtonInteraction
): Promise<void> {
  if (!interaction.guild) {
    return;
  }

  const medalId =
    interaction.customId.split(":")[1];

  if (!medalId) {
    await interaction.reply({
      content:
        "❌ Não foi possível identificar a medalha.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    !(await validateStaffMember(interaction))
  ) {
    return;
  }

  const ticketMedal =
    await prisma.ticketMedal.findUnique({
      where: {
        id: medalId,
      },
      include: {
        medal: true,
        ticket: true,
      },
    });

  if (!ticketMedal) {
    await interaction.reply({
      content:
        "❌ Esta solicitação de medalha não foi encontrada.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    ticketMedal.ticket.channelId !==
    interaction.channelId
  ) {
    await interaction.reply({
      content:
        "❌ Esta medalha não pertence a este ticket.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    ticketMedal.status !==
    "PENDING"
  ) {
    await interaction.reply({
      content:
        "⚠️ Esta medalha já foi analisada.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        `ticket_medal_deny_modal:${ticketMedal.id}`
      )
      .setTitle(
        `Negar: ${ticketMedal.medal.name}`.slice(
          0,
          45
        )
      );

  const reasonInput =
    new TextInputBuilder()
      .setCustomId(
        "ticket_medal_deny_reason"
      )
      .setLabel(
        "Motivo da negativa"
      )
      .setPlaceholder(
        "Informe o motivo da negativa..."
      )
      .setStyle(
        TextInputStyle.Paragraph
      )
      .setRequired(true)
      .setMinLength(5)
      .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        reasonInput
      )
  );

  await interaction.showModal(
    modal
  );
}

// ==========================================================
// ENTREGAR MEDALHA
// ==========================================================

async function handleTicketMedalDeliver(
  interaction: ButtonInteraction
): Promise<void> {
  if (!interaction.guild) {
    return;
  }

  const ticketMedalId =
    interaction.customId.split(":")[1];

  if (!ticketMedalId) {
    await interaction.reply({
      content:
        "❌ Não foi possível identificar a solicitação de medalha.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // VALIDA EQUIPE
  // ========================================================

  if (
    !(await validateStaffMember(interaction))
  ) {
    return;
  }

  // ========================================================
  // BUSCA SOLICITAÇÃO
  // ========================================================

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
      content:
        "❌ Esta solicitação de medalha não foi encontrada.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // VALIDA TICKET
  // ========================================================

  if (
    ticketMedal.ticket.channelId !==
    interaction.channelId
  ) {
    await interaction.reply({
      content:
        "❌ Esta medalha não pertence a este ticket.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // VALIDA STATUS
  // ========================================================

  if (
    ticketMedal.status ===
    "GRANTED"
  ) {
    await interaction.reply({
      content:
        "⚠️ Esta medalha já foi entregue.",
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
        "❌ **A medalha ainda não pode ser entregue.**",
        "",
        `Status atual: **${ticketMedal.status}**`,
        "",
        "A medalha precisa estar aprovada antes da entrega.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // INICIA ENTREGA
  // ========================================================

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  try {
    const result =
      await deliverMedal({
        client:
          interaction.client,
        ticketMedalId:
          ticketMedal.id,
        executorId:
          interaction.user.id,
        requestGuildId:
          interaction.guild.id,
      });

    await interaction.editReply({
      content: [
        "## 🏅 Medalha entregue",
        "",
        `🎖️ **${ticketMedal.medal.name}**`,
        "",
        `👤 **Usuário:** <@${ticketMedal.ticket.userId}>`,
        `🎫 **Ticket:** #${ticketMedal.ticket.ticketNumber}`,
        "",
        `🏛️ **Servidor:** ${result.guild.name}`,
        "",
        result.addedRoleNames.length > 0
          ? [
            "### Cargos adicionados",
            "",
            ...result.addedRoleNames.map(
              (roleName) =>
                `🟢 ${roleName}`
            ),
          ].join("\n")
          : [
            "ℹ️ **Nenhum cargo novo foi adicionado.**",
            "",
            "Os cargos vinculados a esta medalha já estavam atribuídos ao usuário.",
          ].join("\n"),
        "",
        "-# A entrega foi realizada no servidor EB e registrada oficialmente pelo Atlas.",
      ].join("\n"),
    });

    await refreshTicketPanel(
      interaction,
      ticketMedal.ticket.id
    );

    console.log(
      "🏅 [TICKET] Entrega concluída:",
      {
        ticketMedalId:
          ticketMedal.id,
        ticketId:
          ticketMedal.ticket.id,
        ticketNumber:
          ticketMedal.ticket.ticketNumber,
        medalId:
          ticketMedal.medalId,
        medalName:
          ticketMedal.medal.name,
        executorId:
          interaction.user.id,
        deliveryGuildId:
          result.guild.id,
        addedRoles:
          result.addedRoleNames,
        alreadyHadRoles:
          result.alreadyHadRoleNames,
      }
    );
  } catch (error) {
    console.error(
      "❌ [TICKET] Erro durante entrega da medalha:",
      error
    );

    await interaction.editReply({
      content: [
        "## ❌ Não foi possível entregar a medalha",
        "",
        `🎖️ **${ticketMedal.medal.name}**`,
        "",
        error instanceof Error
          ? error.message
          : "O Atlas encontrou um erro durante a entrega.",
        "",
        "-# A medalha não foi marcada como entregue.",
        "-# Corrija o problema e tente novamente.",
      ].join("\n"),
    });
  }
}

// ==========================================================
// VERIFICA SE O SOLICITANTE AINDA ESTÁ NO SERVIDOR
// ==========================================================

async function hasRequesterLeftGuild(
  interaction: ButtonInteraction,
  userId: string
): Promise<boolean> {
  if (!interaction.guild) {
    return true;
  }

  try {
    await interaction.guild.members.fetch(
      userId
    );

    return false;
  } catch {
    return true;
  }
}

// ==========================================================
// FECHAMENTO NORMAL
// ==========================================================

async function handleTicketClose(
    interaction: ButtonInteraction
): Promise<void> {
    if (!interaction.guild) {
        return;
    }

    await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
    });

    const ticket = await prisma.ticket.findFirst({
        where: {
            channelId: interaction.channelId,
        },
        include: {
            medals: true,
        },
    });

  if (!ticket) {
    await interaction.reply({
      content:
        "❌ Este canal não está associado a um ticket.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    ticket.status ===
    "CLOSED"
  ) {
    await interaction.reply({
      content:
        "⚠️ Este ticket já está encerrado.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // IDENTIFICA O NÍVEL DE ACESSO DO EXECUTOR
  // ========================================================

  const config = await prisma.guildConfig.findUnique({
    where: {
        requestGuildId: interaction.guild.id,
    },
});

if (!config) {
    await interaction.reply({
        content: [
            "❌ **O sistema de tickets não está configurado.**",
            "",
            "Não foi possível localizar a configuração deste servidor.",
        ].join("\n"),
        flags: MessageFlags.Ephemeral,
    });

    return;
}

const member = await interaction.guild.members.fetch(
    interaction.user.id,
);

const isResponsible =
    config.responsibleRoleId !== null &&
    member.roles.cache.has(config.responsibleRoleId);

  // ========================================================
  // VERIFICA SE O SOLICITANTE AINDA ESTÁ NO SERVIDOR
  // ========================================================

  const requesterLeft =
    await hasRequesterLeftGuild(
      interaction,
      ticket.userId
    );

  // ========================================================
  // BLOQUEIA FECHAMENTO SE EXISTIR MEDALHA
  // PENDENTE OU APROVADA AINDA NÃO ENTREGUE
  //
  // EXCEÇÃO:
  // Se o solicitante saiu do servidor, o ticket pode
  // ser encerrado mesmo sem a entrega das medalhas.
  // ========================================================

  if (!requesterLeft && !isResponsible) {
    const pendingMedals =
      ticket.medals.filter(
        (medal) =>
          medal.status ===
          "PENDING"
      );

    const approvedMedals =
      ticket.medals.filter(
        (medal) =>
          medal.status ===
          "APPROVED"
      );

    if (
      pendingMedals.length > 0 ||
      approvedMedals.length > 0
    ) {
      const reasons: string[] = [];

      if (pendingMedals.length > 0) {
        reasons.push(
          `🟡 **${pendingMedals.length} medalha(s) aguardando análise.**`
        );
      }

      if (approvedMedals.length > 0) {
        reasons.push(
          `🟠 **${approvedMedals.length} medalha(s) aprovada(s), mas ainda não entregue(s).**`
        );
      }

      await interaction.reply({
        content: [
          "⚠️ **Não é possível encerrar este ticket ainda.**",
          "",
          "Todas as medalhas precisam ter seu processo concluído antes do encerramento.",
          "",
          ...reasons,
          "",
          "🟢 Medalhas entregues podem ser encerradas normalmente.",
          "🔴 Medalhas negadas também não impedem o encerramento.",
          "",
          "-# Caso o solicitante deixe o servidor, o ticket poderá ser encerrado mesmo que existam medalhas pendentes ou aprovadas.",
        ].join("\n"),
        flags: MessageFlags.Ephemeral,
      });

      return;
    }
  }

  if (
    requesterLeft
  ) {
    console.log(
      "⚠️ [TICKET] Solicitante não está mais no servidor. Encerramento liberado:",
      {
        ticketId:
          ticket.id,
        ticketNumber:
          ticket.ticketNumber,
        userId:
          ticket.userId,
      }
    );
  }

  if (
    !interaction.channel ||
    interaction.channel.type !==
    ChannelType.GuildText
  ) {
    await interaction.reply({
      content:
        "❌ Não foi possível acessar o canal deste ticket.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

const transcriptUrl = await createTicketTranscript(
    interaction.channel,
    ticket.id,
    interaction.user.id
);

  if (!transcriptUrl) {
    await interaction.editReply({
      content: [
        "❌ **Não foi possível gerar o transcript deste ticket.**",
        "",
        "O ticket não foi encerrado para evitar a perda do histórico.",
        "",
        "-# Verifique a configuração do canal de transcripts e tente novamente.",
      ].join("\n"),
    });

    return;
  }

  await prisma.ticket.update({
    where: {
      id: ticket.id,
    },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
    },
  });

  await logAuditEvent({
    guild:
      interaction.guild,
    action:
      "TICKET_CLOSED",
    executorId:
      interaction.user.id,
    targetId:
      ticket.userId,
    ticketId:
      ticket.id,
    details: {
      transcriptUrl,
      forceClose: false,
      requesterLeft,
      responsibleOverride: isResponsible,
    },
  });

  // ========================================================
  // ATUALIZA PERMISSÕES DO TICKET FECHADO
  // ========================================================

  if (config.staffRoleId) {
    await interaction.channel.permissionOverwrites.edit(
        config.staffRoleId,
        {
            ViewChannel: false,
        }
    );
}

  // O solicitante também deixa de visualizar o ticket
  // após o encerramento.

  await interaction.channel.permissionOverwrites.edit(
    ticket.userId,
    {
      ViewChannel: false,
    }
  );

  await interaction.editReply({
    content: [
      "## 🔒 Ticket encerrado",
      "",
      "A solicitação foi encerrada com sucesso.",
      "",
      "📄 O transcript foi registrado no sistema.",
      "",
      requesterLeft
        ? "⚠️ **O solicitante não está mais no servidor.**"
        : "✅ **Todas as medalhas tiveram seu processo concluído.**",
      "",
      "-# O ticket foi mantido para histórico e auditoria.",
      "-# A equipe de atendimento não possui mais acesso ao ticket.",
      "-# Os responsáveis pelo setor continuam com acesso para eventual exclusão.",
    ].join("\n"),
  });

  await refreshTicketPanel(
    interaction,
    ticket.id
  );

  console.log(
    "🔒 [TICKET] Ticket encerrado:",
    {
      ticketId:
        ticket.id,
      ticketNumber:
        ticket.ticketNumber,
      requesterLeft,
    }
  );
}

// ==========================================================
// DELETAR TICKET
// ==========================================================

async function handleTicketDelete(
  interaction: ButtonInteraction
): Promise<void> {
  if (!interaction.guild) {
    return;
  }

  const ticket =
    await prisma.ticket.findFirst({
      where: {
        channelId:
          interaction.channelId,
      },
    });

  if (!ticket) {
    await interaction.editReply({
        content:
            "❌ Este canal não está associado a um ticket.",
    });
    return;
}

  if (
    ticket.status !==
    "CLOSED"
  ) {
    await interaction.reply({
      content: [
        "❌ **Este ticket ainda não foi encerrado.**",
        "",
        "O ticket precisa ser encerrado antes de poder ser excluído.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    !(await validateResponsibleMember(interaction))
  ) {
    return;
  }

  await interaction.reply({
    content: [
      "## 🗑️ Ticket excluído",
      "",
      `🎫 **Ticket:** #${ticket.ticketNumber}`,
      "",
      "O ticket foi removido do servidor.",
      "",
      "-# O registro permanece no banco de dados para histórico e auditoria.",
    ].join("\n"),
    flags: MessageFlags.Ephemeral,
  });

  await logAuditEvent({
    guild:
      interaction.guild,
    action:
      "TICKET_DELETED",
    executorId:
      interaction.user.id,
    targetId:
      ticket.userId,
    ticketId:
      ticket.id,
    details: {
      ticketNumber:
        ticket.ticketNumber,
      channelId:
        interaction.channelId,
    },
  });

  console.log(
    "🗑️ [TICKET] Ticket excluído:",
    {
      ticketId:
        ticket.id,
      ticketNumber:
        ticket.ticketNumber,
      executorId:
        interaction.user.id,
    }
  );

  const channel = interaction.channel;

  if (!channel) {
    console.error(
      "❌ [TICKET] Canal não encontrado ao tentar excluir o ticket."
    );

    return;
  }

  try {
    await channel.delete(
      "Ticket excluído por responsável pelo setor."
    );
  } catch (error) {
    console.error(
      "❌ [TICKET] Erro ao excluir canal após exclusão do ticket:",
      error
    );
  }
}

// ==========================================================
// ENCERRAMENTO FORÇADO
// ==========================================================

async function handleTicketForceClose(
  interaction: ButtonInteraction
): Promise<void> {
  if (!interaction.guild) {
    return;
  }

  const ticket =
    await prisma.ticket.findFirst({
      where: {
        channelId:
          interaction.channelId,
      },
    });

  if (!ticket) {
    await interaction.reply({
      content:
        "❌ Este canal não está associado a um ticket.",
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    ticket.status ===
    "CLOSED"
  ) {
    await interaction.reply({
      content:
        "⚠️ Este ticket já está encerrado.",
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  const member =
    await interaction.guild.members.fetch(
      interaction.user.id
    );

  const config = await prisma.guildConfig.findUnique({
    where: {
        requestGuildId: interaction.guild.id,
    },
});

if (!config) {
    await interaction.reply({
        content: [
            "❌ **O sistema de tickets não está configurado.**",
            "",
            "Não foi possível localizar a configuração deste servidor.",
        ].join("\n"),
        flags: MessageFlags.Ephemeral,
    });

    return;
}

const isStaff =
    Boolean(config.staffRoleId) &&
    member.roles.cache.has(config.staffRoleId);

const isResponsible =
    config.responsibleRoleId !== null &&
    member.roles.cache.has(config.responsibleRoleId);

  if (!isStaff && !isResponsible) {
    await interaction.reply({
      content: [
        "❌ **Permissão insuficiente.**",
        "",
        "Apenas **membros da equipe ou responsáveis pelo setor** podem participar do encerramento forçado de um ticket.",
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  const existingApproval =
    await prisma.ticketForceCloseApproval.findFirst(
      {
        where: {
          ticketId:
            ticket.id,
          userId:
            interaction.user.id,
        },
      }
    );

  if (existingApproval) {
    await interaction.reply({
      content: [
        "⚠️ **Aprovação já registrada.**",
        "",
        "Você já aprovou o encerramento forçado deste ticket.",
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  await prisma.ticketForceCloseApproval.create({
    data: {
      ticketId:
        ticket.id,
      userId:
        interaction.user.id,
    },
  });

  const approvals =
    await prisma.ticketForceCloseApproval.count({
      where: {
        ticketId:
          ticket.id,
      },
    });

  if (
    approvals < 2
  ) {
    await interaction.reply({
      content: [
        "## ⚠️ Aprovação registrada",
        "",
        `👥 Aprovações: **${approvals}/2**`,
        "",
        "É necessária a aprovação de pelo menos **duas pessoas autorizadas da equipe ou dos responsáveis pelo setor** para realizar o encerramento forçado.",
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    !interaction.channel ||
    interaction.channel.type !==
    ChannelType.GuildText
  ) {
    await interaction.reply({
      content: [
        "❌ **Não foi possível acessar o canal deste ticket.**",
        "",
        "O encerramento forçado não foi concluído para evitar a perda do histórico.",
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  const transcriptUrl =
    await createTicketTranscript(
      interaction.channel,
      ticket.id,
      interaction.user.id
    );

  if (!transcriptUrl) {
    await interaction.reply({
      content: [
        "❌ **Não foi possível gerar o transcript deste ticket.**",
        "",
        "O encerramento forçado não foi concluído para evitar a perda do histórico.",
        "",
        "-# Verifique a configuração do canal de transcripts e tente novamente.",
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  await prisma.ticket.update({
    where: {
      id:
        ticket.id,
    },
    data: {
      status:
        "CLOSED",
      closedAt:
        new Date(),
    },
  });

  await logAuditEvent({
    guild:
      interaction.guild,
    action:
      "TICKET_CLOSED",
    executorId:
      interaction.user.id,
    targetId:
      ticket.userId,
    ticketId:
      ticket.id,
    details: {
      reason:
        "Encerramento forçado",
      forceClose:
        true,
      approvals,
      transcriptUrl,
    },
  });

  if (config.staffRoleId) {
    await interaction.channel.permissionOverwrites.edit(
      config.staffRoleId,
      {
        ViewChannel: false,
      }
    );
  }

  await interaction.channel.permissionOverwrites.edit(
    ticket.userId,
    {
      ViewChannel: false,
    }
  );

  await interaction.reply({
    content: [
      "## 🔒 Ticket encerrado forçadamente",
      "",
      "O ticket foi encerrado após atingir o número mínimo de aprovações da equipe ou dos responsáveis pelo setor.",
      "",
      `👥 **Aprovações:** ${approvals}/2`,
      "📄 **Transcript:** registrado no sistema",
      "",
      "-# O ticket foi mantido para histórico e auditoria.",
      "-# A exclusão definitiva do canal permanece disponível somente aos responsáveis pelo setor.",
    ].join("\n"),
    flags:
      MessageFlags.Ephemeral,
  });

  await refreshTicketPanel(
    interaction,
    ticket.id
  );
}

// ==========================================================
// ATUALIZA PAINEL DO TICKET
// ==========================================================

async function refreshTicketPanel(
  interaction: ButtonInteraction,
  ticketId: string
): Promise<void> {
  try {
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
          proofs: true,
        },
      });

    if (!ticket) {
      console.warn(
        "⚠️ [TICKET] Ticket não encontrado ao atualizar painel:",
        ticketId
      );

      return;
    }

    const channel =
      interaction.channel;

    if (
      !channel ||
      !channel.isTextBased() ||
      !("messages" in channel)
    ) {
      console.warn(
        "⚠️ [TICKET] Canal inválido ao atualizar painel:",
        ticketId
      );

      return;
    }

    const messages =
      await channel.messages.fetch({
        limit: 50,
      });

    const botMessage =
      messages.find(
        (msg) =>
          msg.author.id ===
          interaction.client.user?.id &&
          msg.components.length > 0
      );

    if (!botMessage) {
      console.warn(
        "⚠️ [TICKET] Painel principal não encontrado:",
        ticket.id
      );

      return;
    }

    const pending =
      ticket.medals.filter(
        (medal) =>
          medal.status ===
          "PENDING"
      ).length;

    const approved =
      ticket.medals.filter(
        (medal) =>
          medal.status ===
          "APPROVED"
      ).length;

    const denied =
      ticket.medals.filter(
        (medal) =>
          medal.status ===
          "DENIED"
      ).length;

    const granted =
      ticket.medals.filter(
        (medal) =>
          medal.status ===
          "GRANTED"
      ).length;

    const status =
      ticket.status === "CLOSED"
        ? "🔒 **Ticket encerrado**"
        : pending > 0
          ? "🔵 **Aguardando análise da equipe**"
          : approved > 0
            ? "🟠 **Medalhas aprovadas aguardando entrega**"
            : "🟢 **Processo de medalhas concluído**";

    const medalList =
      ticket.medals
        .map(
          (ticketMedal, index) => {
            const medal =
              ticketMedal.medal;

            const emoji =
              medal.emoji
                ? `${medal.emoji} `
                : "🎖️ ";

            let medalStatus =
              "🟡 Pendente";

            if (
              ticketMedal.status ===
              "APPROVED"
            ) {
              medalStatus =
                "🟠 Aprovada • aguardando entrega";
            }

            if (
              ticketMedal.status ===
              "DENIED"
            ) {
              medalStatus =
                "🔴 Negada";
            }

            if (
              ticketMedal.status ===
              "GRANTED"
            ) {
              medalStatus =
                "🟢 Entregue";
            }

            return [
              `**${index + 1}.** ${emoji}${medal.name}`,
              `-# ${medal.category?.name ?? "Sem categoria"} • ${medalStatus}`,
            ].join("\n");
          }
        )
        .join("\n\n");

    const config =
      await prisma.guildConfig.findUnique({
        where: {
          requestGuildId:
            interaction.guild?.id ?? "",
        },
      });

    const container =
      new ContainerBuilder()
        .setAccentColor(
          ticket.status === "CLOSED"
            ? 0x7f8c8d
            : pending > 0
              ? 0x3498db
              : approved > 0
                ? 0xf39c12
                : denied > 0 && granted === 0
                  ? 0xe74c3c
                  : 0x2ecc71
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(
              [
                "# 🎖️ Solicitação de Medalhas",
                `### Ticket #${ticket.ticketNumber}`,
                "",
                `👤 **Solicitante:** <@${ticket.userId}>`,
                `🎮 **Roblox:** \`${ticket.robloxUsername}\``,
                "",
                config?.staffRoleId
                  ? `👥 **Equipe responsável:** <@&${config.staffRoleId}>`
                  : "👥 **Equipe responsável:** Não configurada",
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
                "## 📎 Provas recebidas",
                "",
                `🟢 **${ticket.proofs.length} prova(s)** registrada(s) nesta solicitação.`,
                "",
                "As provas permanecem disponíveis neste canal para consulta da equipe responsável.",
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
                "## 🏅 Medalhas solicitadas",
                "",
                medalList ||
                "-# Nenhuma medalha encontrada.",
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
                "## 🔎 Status da análise",
                "",
                status,
                "",
                `🟡 **Pendentes:** ${pending}`,
                `🟠 **Aguardando entrega:** ${approved}`,
                `🟢 **Entregues:** ${granted}`,
                `🔴 **Negadas:** ${denied}`,
              ].join("\n")
            )
        );

    // ======================================================
    // TICKET ABERTO — BOTÕES DE ANÁLISE
    // ======================================================

    if (
      ticket.status !==
      "CLOSED"
    ) {
      for (
        const ticketMedal of ticket.medals
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

          container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                approveButton,
                denyButton
              )
          );

          continue;
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
              .setEmoji("🏅")
              .setStyle(
                ButtonStyle.Primary
              );

          container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                deliverButton
              )
          );
        }
      }

      // ====================================================
      // BOTÕES DO TICKET ABERTO
      // ====================================================

      const closeButton =
        new ButtonBuilder()
          .setCustomId(
            "ticket_close"
          )
          .setLabel(
            "Encerrar ticket"
          )
          .setEmoji("🔒")
          .setStyle(
            ButtonStyle.Secondary
          );

      const forceCloseButton =
        new ButtonBuilder()
          .setCustomId(
            `ticket_force_close:${ticket.id}`
          )
          .setLabel(
            "Solicitar encerramento forçado"
          )
          .setEmoji("⚠️")
          .setStyle(
            ButtonStyle.Danger
          );

      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            closeButton,
            forceCloseButton
          )
      );
    }

    // ======================================================
    // TICKET FECHADO — BOTÃO DE DELETAR
    // ======================================================

    if (
      ticket.status ===
      "CLOSED"
    ) {
      const deleteButton =
        new ButtonBuilder()
          .setCustomId(
            "ticket_delete"
          )
          .setLabel(
            "Deletar ticket"
          )
          .setEmoji("🗑️")
          .setStyle(
            ButtonStyle.Danger
          );

      container.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              "## 🔒 Ticket encerrado",
              "",
              "Este ticket foi encerrado e permanece disponível para consulta histórica.",
              "",
              "-# A exclusão definitiva do canal pode ser realizada somente pelos responsáveis pelo setor.",
            ].join("\n")
          )
      );

      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            deleteButton
          )
      );
    }

    await botMessage.edit({
      content: null,
      embeds: [],
      components: [
        container,
      ],
      flags:
        MessageFlags.IsComponentsV2,
    });

    console.log(
      "✨ [TICKET] Painel atualizado:",
      {
        ticketId,
        ticketNumber:
          ticket.ticketNumber,
        ticketStatus:
          ticket.status,
        pending,
        approved,
        granted,
        denied,
        proofs:
          ticket.proofs.length,
      }
    );
  } catch (error) {
    console.error(
      "❌ [TICKET] Erro ao atualizar painel:",
      error
    );
  }
}