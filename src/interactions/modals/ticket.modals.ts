import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  ModalSubmitInteraction,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from "discord.js";

import {
  updateAnalysisPanel,
} from "../buttons/ticket.analysis.buttons.js";

import { prisma } from "../../infrastructure/database/prisma.js";

import {
  logAuditEvent,
} from "../../services/audit-log.service.js";

import {
  createTicket,
} from "../../services/ticket.service.js";

// ==========================================================
// MODAIS DE TICKET
// ==========================================================

export async function handleTicketRobloxModal(
  interaction: ModalSubmitInteraction
): Promise<void> {
  // ========================================================
  // VERIFICA CUSTOM ID
  // ========================================================

  if (
    !interaction.customId.startsWith(
      "ticket_roblox_modal:"
    )
  ) {
    return;
  }

  // ========================================================
  // VERIFICA SERVIDOR
  // ========================================================

  if (!interaction.guild) {
    await interaction.reply({
      content: [
        "## ❌ Ação indisponível",
        "",
        "Esta etapa só pode ser utilizada dentro de um servidor.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // RECUPERA DADOS DO CUSTOM ID
  // ========================================================

  const parts =
    interaction.customId.split(":");

  const userId = parts[1];
  const medalIdsString = parts[2];

  if (!userId || !medalIdsString) {
    await interaction.reply({
      content: [
        "## ❌ Solicitação inválida",
        "",
        "Não foi possível recuperar os dados da sua solicitação.",
        "",
        "-# Tente iniciar o processo novamente.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // VERIFICA USUÁRIO
  // ========================================================

  if (
    interaction.user.id !== userId
  ) {
    await interaction.reply({
      content: [
        "## 🔒 Acesso restrito",
        "",
        "Esta solicitação pertence a outro usuário.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // RECUPERA NOME DO ROBLOX
  // ========================================================

  let robloxUsername: string;

  try {
    robloxUsername =
      interaction.fields
        .getTextInputValue(
          "roblox_username"
        )
        .trim();
  } catch {
    await interaction.reply({
      content: [
        "## ❌ Dados incompletos",
        "",
        "Não foi possível recuperar o nome de usuário do Roblox.",
        "",
        "-# Tente preencher o formulário novamente.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // VALIDA TAMANHO
  // ========================================================

  if (
    robloxUsername.length < 3 ||
    robloxUsername.length > 20
  ) {
    await interaction.reply({
      content: [
        "## ❌ Nome do Roblox inválido",
        "",
        "O nome de usuário precisa possuir entre **3 e 20 caracteres**.",
        "",
        "-# Confira o nome informado e tente novamente.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // VALIDA FORMATO
  // ========================================================

  if (
    !/^[a-zA-Z0-9_]+$/.test(
      robloxUsername
    )
  ) {
    await interaction.reply({
      content: [
        "## ❌ Nome do Roblox inválido",
        "",
        "O nome informado contém caracteres que não são aceitos pelo Roblox.",
        "",
        "Utilize apenas:",
        "• Letras",
        "• Números",
        "• `_`",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // RECUPERA MEDALHAS
  // ========================================================

  const medalIds =
    [
      ...new Set(
        medalIdsString
          .split(",")
          .filter(Boolean)
      ),
    ];

  if (
    medalIds.length < 1 ||
    medalIds.length > 3
  ) {
    await interaction.reply({
      content: [
        "## ❌ Solicitação inválida",
        "",
        "Uma solicitação deve possuir entre **1 e 3 medalhas**.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // BUSCA CONFIGURAÇÃO
  // ========================================================

  const config =
    await prisma.guildConfig.findUnique({
      where: {
        requestGuildId:
          interaction.guild.id,
      },
    });

  if (!config) {
    await interaction.reply({
      content: [
        "## ⚙️ Sistema não configurado",
        "",
        "O sistema de tickets ainda não foi configurado neste servidor.",
        "",
        "-# Entre em contato com um administrador.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    !config.ticketCategoryId ||
    !config.staffRoleId
  ) {
    await interaction.reply({
      content: [
        "## ⚙️ Configuração incompleta",
        "",
        "A configuração do sistema de tickets está incompleta.",
        "",
        "-# Um administrador precisa revisar o setup do Atlas.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // VERIFICA TICKET EXISTENTE
  // ========================================================

  const existingTicket =
    await prisma.ticket.findFirst({
      where: {
        userId:
          interaction.user.id,

        status:
          "OPEN",
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
          "## ⚠️ Solicitação já existente",
          "",
          "Você já possui uma solicitação em andamento.",
          "",
          `🎫 **Ticket:** ${existingChannel}`,
          "",
          "-# Não é possível manter duas solicitações simultaneamente.",
        ].join("\n"),
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    // ======================================================
    // CANAL ANTIGO NÃO EXISTE MAIS
    // ======================================================

    await prisma.ticket.update({
      where: {
        id:
          existingTicket.id,
      },

      data: {
        status:
          "CLOSED",

        closedAt:
          new Date(),
      },
    });
  }

  // ========================================================
  // BUSCA MEDALHAS
  // ========================================================

  const medals =
    await prisma.medal.findMany({
      where: {
        id: {
          in: medalIds,
        },

        active:
          true,
      },

      include: {
        category:
          true,
      },
    });

  if (
    medals.length !==
    medalIds.length
  ) {
    await interaction.reply({
      content: [
        "## ❌ Medalha indisponível",
        "",
        "Uma ou mais medalhas selecionadas não estão mais disponíveis.",
        "",
        "-# Volte ao início e faça uma nova seleção.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // DEFER
  // ========================================================

  await interaction.deferReply({
    flags:
      MessageFlags.Ephemeral,
  });

  let channelId:
    string | null = null;

  let ticketId:
    string | null = null;

  try {
    // ======================================================
    // BUSCA MEMBRO
    // ======================================================

    const member =
      await interaction.guild.members.fetch(
        interaction.user.id
      );

    // ======================================================
    // CRIA TICKET
    // ======================================================

    const {
      ticket,
      channel,
    } = await createTicket({
      guild:
        interaction.guild,

      userId:
        interaction.user.id,

      username:
        interaction.user.username,

      nickname:
        member.nickname ??
        null,

      robloxUsername,

      medalIds,
    });

    channelId =
      channel.id;

    ticketId =
      ticket.id;

    // ======================================================
    // ORGANIZA MEDALHAS
    // ======================================================

    const orderedMedals =
      medalIds
        .map(
          (id) =>
            medals.find(
              (medal) =>
                medal.id ===
                id
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
          (
            medal,
            index
          ) => {
            const emoji =
              medal.emoji
                ? `${medal.emoji} `
                : "🎖️ ";

            return [
              `**${index + 1}.** ${emoji}${medal.name}`,
              `-# ${medal.category.name}`,
            ].join("\n");
          }
        )
        .join("\n\n");

    // ======================================================
    // BOTÕES
    // ======================================================

    const closeButton =
      new ButtonBuilder()
        .setCustomId(
          "ticket_close"
        )
        .setLabel(
          "Encerrar ticket"
        )
        .setEmoji(
          "🔒"
        )
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
        .setEmoji(
          "⚠️"
        )
        .setStyle(
          ButtonStyle.Danger
        );

    const actionRow =
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          closeButton,
          forceCloseButton
        );

    // ======================================================
    // CONTAINER V2
    // ======================================================

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
                "",
                `👤 **Solicitante:** <@${interaction.user.id}>`,
                `🎮 **Roblox:** \`${robloxUsername}\``,
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
                "## 📎 Próxima etapa — Envio das provas",
                "",
                "Sua solicitação foi registrada com sucesso.",
                "",
                "Envie neste canal as **provas necessárias para a análise das medalhas**.",
                "",
                "Você pode enviar imagens, vídeos ou outros arquivos aceitos pelo Discord.",
                "",
                "💡 **Importante:** todas as provas relacionadas à solicitação devem ser enviadas neste ticket.",
                "",
                "🟡 **Status:** Aguardando provas",
                "",
                "-# Mensagens sem anexos serão removidas automaticamente enquanto o ticket estiver aguardando provas.",
              ].join("\n")
            )
        )

        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(
              SeparatorSpacingSize.Small
            )
        )

        .addActionRowComponents(
          actionRow
        );

    // ======================================================
    // ENVIA PAINEL
    // ======================================================

    await channel.send({
      components: [
        container,
      ],

      flags:
        MessageFlags.IsComponentsV2,
    });

    // ======================================================
    // CONFIRMAÇÃO
    // ======================================================

    await interaction.editReply({
      content: [
        "## ✅ Solicitação criada",
        "",
        `🎫 **Ticket:** ${channel}`,
        "",
        "Sua solicitação foi criada com sucesso.",
        "",
        `🎮 **Roblox:** \`${robloxUsername}\``,
        "",
        "### 📎 Próximo passo",
        "",
        "Acesse o ticket e envie as **provas necessárias** para sua solicitação.",
        "",
        "-# A equipe responsável iniciará a análise após o recebimento das provas.",
      ].join("\n"),
    });

    // ======================================================
    // LOG
    // ======================================================

    await logAuditEvent({
      guild:
        interaction.guild,

      action:
        "TICKET_CREATED",

      executorId:
        interaction.user.id,

      targetId:
        interaction.user.id,

      ticketId:
        ticket.id,

      details: {
        ticketNumber:
          ticket.ticketNumber,

        channelId:
          channel.id,

        robloxUsername,

        medalIds,
      },
    });

    console.log(
      "🎫 [TICKET] Ticket criado após identificação Roblox:",
      {
        ticketId:
          ticket.id,

        channelId:
          channel.id,

        userId:
          interaction.user.id,

        robloxUsername,

        medalIds,
      }
    );
  } catch (error) {
    // ======================================================
    // LOG
    // ======================================================

    console.error(
      "❌ [TICKET] Erro ao criar ticket após Modal Roblox:",
      error
    );

    // ======================================================
    // REMOVE TICKET
    // ======================================================

    if (ticketId) {
      try {
        await prisma.ticket.delete({
          where: {
            id:
              ticketId,
          },
        });
      } catch (
        cleanupError
      ) {
        console.error(
          "❌ [TICKET] Erro ao limpar ticket:",
          cleanupError
        );
      }
    }

    // ======================================================
    // REMOVE CANAL
    // ======================================================

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
      } catch (
        cleanupError
      ) {
        console.error(
          "❌ [TICKET] Erro ao remover canal:",
          cleanupError
        );
      }
    }

    // ======================================================
    // INFORMA USUÁRIO
    // ======================================================

    await interaction.editReply({
      content: [
        "## ❌ Não foi possível criar a solicitação",
        "",
        "O Atlas encontrou um problema ao criar seu ticket.",
        "",
        "-# Nenhuma solicitação foi mantida parcialmente.",
        "-# Tente novamente em alguns instantes.",
      ].join("\n"),
    });
  }
}

// ==========================================================
// NEGAR MEDALHA
// ==========================================================

export async function handleTicketMedalDenyModal(
  interaction: ModalSubmitInteraction
): Promise<void> {
  // ========================================================
  // VERIFICA CUSTOM ID
  // ========================================================

  if (
    !interaction.customId.startsWith(
      "ticket_medal_deny_modal:"
    )
  ) {
    return;
  }

  // ========================================================
  // VERIFICA SERVIDOR
  // ========================================================

  if (!interaction.guild) {
    await interaction.reply({
      content: [
        "## ❌ Ação indisponível",
        "",
        "Esta ação só pode ser utilizada dentro de um servidor.",
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // RECUPERA ID
  // ========================================================

  const ticketMedalId =
    interaction.customId.split(":")[1];

  if (!ticketMedalId) {
    await interaction.reply({
      content: [
        "## ❌ Solicitação inválida",
        "",
        "Não foi possível identificar a medalha desta solicitação.",
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // BUSCA TICKET MEDAL
  // ========================================================

  const ticketMedal =
    await prisma.ticketMedal.findUnique({
      where: {
        id:
          ticketMedalId,
      },

      include: {
        medal:
          true,

        ticket:
          true,
      },
    });

  if (!ticketMedal) {
    await interaction.reply({
      content: [
        "## ❌ Medalha não encontrada",
        "",
        "Esta medalha não está mais associada a uma solicitação válida.",
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // VERIFICA TICKET
  // ========================================================

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
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // VERIFICA SE A INTERAÇÃO ESTÁ NO TICKET
  // ========================================================

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
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // BUSCA CONFIGURAÇÃO
  // ========================================================

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
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // VERIFICA EQUIPE
  // ========================================================

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
      content: [
        "## 🔒 Acesso restrito",
        "",
        "Apenas membros da equipe de medalhas podem analisar solicitações.",
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // VERIFICA STATUS
  // ========================================================

  if (
    ticketMedal.status !==
    "PENDING"
  ) {
    let statusText =
      "já foi processada";

    if (
      ticketMedal.status ===
      "APPROVED"
    ) {
      statusText =
        "já foi aprovada";
    }

    if (
      ticketMedal.status ===
      "DENIED"
    ) {
      statusText =
        "já foi negada";
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
        "## ⚠️ Medalha já analisada",
        "",
        `Esta medalha ${statusText}.`,
        "",
        "-# Uma decisão já registrada não pode ser substituída.",
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // RECUPERA JUSTIFICATIVA
  // ========================================================

  let reason: string;

  try {
    reason =
      interaction.fields
        .getTextInputValue(
          "deny_reason"
        )
        .trim();
  } catch {
    await interaction.reply({
      content: [
        "## ❌ Justificativa inválida",
        "",
        "Não foi possível recuperar a justificativa da negativa.",
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    reason.length < 5 ||
    reason.length > 1000
  ) {
    await interaction.reply({
      content: [
        "## ❌ Justificativa inválida",
        "",
        "A justificativa deve possuir entre **5 e 1000 caracteres**.",
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // ATUALIZA BANCO
  // ========================================================

  const updated =
    await prisma.ticketMedal.update({
      where: {
        id:
          ticketMedal.id,
      },

      data: {
        status:
          "DENIED",

        decidedBy:
          interaction.user.id,

        reason,
      },

      include: {
        medal:
          true,

        ticket:
          true,
      },
    });

  // ========================================================
  // REGISTRA AUDITORIA
  // ========================================================

  await logAuditEvent({
    guild:
      interaction.guild,

    action:
      "MEDAL_DENIED",

    executorId:
      interaction.user.id,

    targetId:
      updated.ticket.userId,

    ticketId:
      updated.ticket.id,

    medalId:
      updated.medalId,

    details: {
      ticketMedalId:
        updated.id,

      medalName:
        updated.medal.name,

      reason,
    },
  });

  // ========================================================
  // ATUALIZA PAINEL
  // ========================================================
  //
  // ModalSubmitInteraction não possui `message`.
  // Portanto, buscamos o canal do ticket e a mensagem
  // de análise diretamente pelo canal.
  //
  // O painel é identificado pelo conteúdo/texto
  // "🔎 Análise da solicitação".
  // ========================================================

  const ticketChannel =
    await interaction.guild.channels.fetch(
      updated.ticket.channelId
    );

  if (
    ticketChannel &&
    ticketChannel.isTextBased() &&
    ticketChannel.isSendable()
  ) {
    try {
      const messages =
        await ticketChannel.messages.fetch({
          limit: 50,
        });

      const analysisMessage =
        messages.find(
          (message) =>
            message.components.some(
              (component) =>
                "components" in component
            )
        );

      if (analysisMessage) {
        await updateAnalysisPanel(
          {
            message:
              analysisMessage,
          },
          updated.ticketId
        );
      }
    } catch (error) {
      console.error(
        "❌ [TICKET] Erro ao localizar painel de análise após negativa:",
        error
      );
    }
  }

  // ========================================================
  // RESPOSTA
  // ========================================================

  await interaction.reply({
    content: [
      "## ❌ Medalha negada",
      "",
      `🏅 **${updated.medal.name}** foi negada.`,
      "",
      `👤 **Responsável:** <@${interaction.user.id}>`,
      "",
      `📝 **Justificativa:** ${reason}`,
    ].join("\n"),

    flags:
      MessageFlags.Ephemeral,
  });

  // ========================================================
  // LOG LOCAL
  // ========================================================

  console.log(
    "❌ [TICKET] Medalha negada:",
    {
      ticketMedalId:
        updated.id,

      ticketId:
        updated.ticketId,

      medalId:
        updated.medalId,

      executorId:
        interaction.user.id,

      reason,
    }
  );
}