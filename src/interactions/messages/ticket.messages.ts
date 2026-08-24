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

import { prisma } from "../../infrastructure/database/prisma.js";

// ==========================================================
// MENSAGENS DE TICKET
// ==========================================================

export async function handleTicketMessage(
  message: Message
): Promise<void> {
  // ========================================================
  // IGNORA BOTS
  // ========================================================

  if (message.author.bot) {
    return;
  }

  // ========================================================
  // IGNORA MENSAGENS FORA DE SERVIDOR
  // ========================================================

  if (!message.guild) {
    return;
  }

  // ========================================================
  // BUSCA TICKET
  // ========================================================

  const ticket =
    await prisma.ticket.findFirst({
      where: {
        channelId: message.channel.id,
        status: "OPEN",
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

  // ========================================================
  // NÃO É UM TICKET
  // ========================================================

  if (!ticket) {
    return;
  }

  // ========================================================
  // APENAS O SOLICITANTE PASSA POR ESTE CONTROLE
  // ========================================================

  if (
    message.author.id !==
    ticket.userId
  ) {
    return;
  }

  // ========================================================
  // VERIFICA ANEXOS
  // ========================================================

  // ========================================================
// VERIFICA ANEXOS
// ========================================================

const existingProofCount =
    await prisma.ticketProof.count({
        where: {
            ticketId: ticket.id,
        },
    });

if (
    message.attachments.size === 0 &&
    existingProofCount === 0) {
  try {
    await message.delete();

    console.log(
      "🗑️ [TICKET] Mensagem sem prova removida:",
      {
        ticketId: ticket.id,
        messageId: message.id,
        userId: message.author.id,
      }
    );

    // ======================================================
    // VERIFICA SE O CANAL PERMITE ENVIO
    // ======================================================

    if (
      !message.channel.isTextBased() ||
      !("send" in message.channel)
    ) {
      return;
    }

    // ======================================================
    // AVISO AO USUÁRIO
    // ======================================================

    const warningMessage =
      await message.channel.send({
        content: [
          `⚠️ <@${message.author.id}>`,
          "",
          "Sua mensagem foi removida porque este ticket aceita **apenas mensagens acompanhadas de anexos como prova**.",
          "",
          "📎 Envie uma imagem, vídeo ou outro arquivo aceito pelo Discord.",
        ].join("\n"),
      });

    // ======================================================
    // REMOVE O AVISO APÓS 8 SEGUNDOS
    // ======================================================

    setTimeout(async () => {
      try {
        await warningMessage.delete();
      } catch {
        // A mensagem pode já ter sido removida.
      }
    }, 8000);
  } catch (error) {
    console.error(
      "❌ [TICKET] Não foi possível processar mensagem sem prova:",
      error
    );
  }

  return;
}

  // ========================================================
  // RECUPERA ANEXOS
  // ========================================================

  const attachments =
    Array.from(
      message.attachments.values()
    );

  if (
    attachments.length === 0
  ) {
    return;
  }

  // ========================================================
  // REGISTRA PROVAS
  // ========================================================

  try {
    await prisma.ticketProof.createMany({
      data: attachments.map(
        (attachment) => ({
          ticketId: ticket.id,
          userId: message.author.id,
          messageId: message.id,
          channelId: message.channel.id,
          url: attachment.url,
          fileName:
            attachment.name ?? null,
        })
      ),
    });

    console.log(
      "📎 [TICKET] Provas registradas:",
      {
        ticketId: ticket.id,
        messageId: message.id,
        userId: message.author.id,
        amount: attachments.length,
        files: attachments.map(
          (attachment) =>
            attachment.name
        ),
      }
    );
  } catch (error) {
    console.error(
      "❌ [TICKET] Erro ao registrar provas:",
      error
    );

    return;
  }

  // ========================================================
  // QUANTIDADE TOTAL DE PROVAS
  // ========================================================

  const proofCount =
    await prisma.ticketProof.count({
      where: {
        ticketId: ticket.id,
      },
    });

  // ========================================================
  // VERIFICA SE É A PRIMEIRA PROVA
  // ========================================================

  const firstProof = existingProofCount === 0;

// ========================================================
// REGISTRA ENVIO DAS PROVAS
// ========================================================

if (firstProof) {
  await prisma.ticket.update({
    where: {
      id: ticket.id,
    },
    data: {
      proofsSubmittedAt: new Date(),
    },
  });

  console.log(
    "📎 [TICKET] proofsSubmittedAt registrado:",
    {
      ticketId: ticket.id,
      proofsSubmittedAt: new Date(),
    }
  );
}

  // ========================================================
  // PRIMEIRA PROVA
  // ========================================================

  if (firstProof) {
    console.log(
      "📎 [TICKET] Primeira prova recebida:",
      ticket.id
    );

    await buildTicketAnalysisContainer(
      message,
      ticket.id
    );

    return;
  }

  // ========================================================
  // PROVA ADICIONAL
  // ========================================================

  console.log(
    "📎 [TICKET] Nova prova adicionada:",
    {
      ticketId: ticket.id,
      totalProofs: proofCount,
    }
  );
}

// ==========================================================
// CONSTRÓI PAINEL DE ANÁLISE
// ==========================================================

export async function buildTicketAnalysisContainer(
  message: Message,
  ticketId: string
): Promise<void> {
  // ========================================================
  // BUSCA TICKET
  // ========================================================

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
    console.warn(
      "⚠️ [TICKET] Ticket não encontrado:",
      ticketId
    );

    return;
  }

  // ========================================================
  // BUSCA PROVAS
  // ========================================================

  const proofCount =
    await prisma.ticketProof.count({
      where: {
        ticketId: ticket.id,
      },
    });

  // ========================================================
  // MONTA LISTA DE MEDALHAS
  // ========================================================

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

          const status =
            ticketMedal.status ===
            "PENDING"
              ? "🟡 Pendente"
              : ticketMedal.status ===
                "APPROVED"
              ? "🟢 Aprovada"
              : "🔴 Negada";

          return [
            `**${index + 1}.** ${emoji}${medal.name}`,
            `-# ${medal.category.name} • ${status}`,
          ].join("\n");
        }
      )
      .join("\n\n");

  // ========================================================
  // CONTAINER V2
  // ========================================================

  const container =
    new ContainerBuilder()
      .setAccentColor(
        0x3498db
      )

      // ====================================================
      // CABEÇALHO
      // ====================================================

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              "# 🎖️ Solicitação de Medalhas",
              "",
              `👤 **Solicitante:** <@${ticket.userId}>`,
              `🎮 **Roblox:** \`${ticket.robloxUsername}\``,
            ].join("\n")
          )
      )

      // ====================================================
      // SEPARADOR
      // ====================================================

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      // ====================================================
      // PROVAS
      // ====================================================

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              "## 📎 Provas recebidas",
              "",
              `🟢 **${proofCount} prova(s)** registrada(s).`,
              "",
              "As provas enviadas pelo solicitante foram registradas e estão disponíveis para análise da equipe responsável.",
            ].join("\n")
          )
      )

      // ====================================================
      // SEPARADOR
      // ====================================================

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      // ====================================================
      // MEDALHAS
      // ====================================================

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

      // ====================================================
      // SEPARADOR
      // ====================================================

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      // ====================================================
      // STATUS
      // ====================================================

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              "## 🔎 Status",
              "",
              "🔵 **Aguardando análise da equipe**",
              "",
              "-# As medalhas podem ser analisadas individualmente.",
              "-# As provas permanecem disponíveis neste canal.",
            ].join("\n")
          )
      );

  // ========================================================
  // BOTÃO DE ENCERRAMENTO
  // ========================================================

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

  // ========================================================
  // LINHA PRINCIPAL
  // ========================================================

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            closeButton
        )
);

  // ========================================================
  // BOTÕES DE ANÁLISE
  // ========================================================

  for (
    const ticketMedal of ticket.medals
  ) {
    if (
      ticketMedal.status !==
      "PENDING"
    ) {
      continue;
    }

    // ======================================================
    // APROVAR
    // ======================================================

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

    // ======================================================
    // NEGAR
    // ======================================================

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

    // ======================================================
    // LINHA
    // ======================================================

    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          approveButton,
          denyButton
        )
    );
  }

  // ========================================================
  // LOCALIZA MENSAGEM PRINCIPAL
  // ========================================================

  try {
    const channel =
      message.channel;

    if (
      !channel.isTextBased() ||
      !("messages" in channel)
    ) {
      console.warn(
        "⚠️ [TICKET] Canal não permite buscar mensagens:",
        ticket.channelId
      );

      return;
    }

    // ======================================================
    // ID DO ATLAS
    // ======================================================

    const botUserId =
      message.client.user?.id;

    if (!botUserId) {
      console.warn(
        "⚠️ [TICKET] Usuário do Atlas não identificado."
      );

      return;
    }

    // ======================================================
    // BUSCA MENSAGENS
    // ======================================================

    const messages =
      await channel.messages.fetch({
        limit: 50,
      });

    // ======================================================
    // MENSAGENS DO ATLAS
    // ======================================================

    const botMessages =
      messages.filter(
        (msg) =>
          msg.author.id ===
          botUserId
      );

    if (
      botMessages.size === 0
    ) {
      console.warn(
        "⚠️ [TICKET] Nenhuma mensagem do Atlas encontrada:",
        ticket.id
      );

      return;
    }

    // ======================================================
    // PRIORIZA MENSAGEM COM COMPONENTES
    // ======================================================

    const botMessage =
      botMessages.find(
        (msg) =>
          msg.components.length >
          0
      ) ??
      botMessages.first();

    if (!botMessage) {
      console.warn(
        "⚠️ [TICKET] Mensagem principal não encontrada:",
        ticket.id
      );

      return;
    }

    // ======================================================
    // ATUALIZA MENSAGEM
    // ======================================================

    await botMessage.edit({
      content: null,
      embeds: [],
      components: [
        container,
      ],
      flags:
        MessageFlags.IsComponentsV2,
    });

    // ======================================================
    // LOG
    // ======================================================

    console.log(
      "✨ [TICKET] Painel de análise atualizado:",
      {
        ticketId: ticket.id,
        proofCount,
        messageId:
          botMessage.id,
      }
    );
  } catch (error) {
    console.error(
      "❌ [TICKET] Erro ao atualizar painel de análise:",
      error
    );
  }
}