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
  if (message.author.bot) {
    return;
  }

  if (!message.guild) {
    return;
  }

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

  if (!ticket) {
    return;
  }

  if (
    message.author.id !==
    ticket.userId
  ) {
    return;
  }

  const existingProofCount =
    await prisma.ticketProof.count({
      where: {
        ticketId: ticket.id,
      },
    });

  if (
    message.attachments.size === 0 &&
    existingProofCount === 0
  ) {
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

      if (
        !message.channel.isTextBased() ||
        !("send" in message.channel)
      ) {
        return;
      }

      const warningContainer =
        new ContainerBuilder()
          .setAccentColor(0xfee75c)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [
                `# ⚠️ <@${message.author.id}> Mensagem removida`,
                "",
                "Este ticket aceita apenas mensagens acompanhadas de anexos como prova.",
              ].join("\n")
            )
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [
                "## 📎 O que enviar",
                "",
                "📸 Imagens",
                "🎥 Vídeos",
                "📄 Documentos",
                "",
                "-# Envie o arquivo diretamente neste canal para que ele seja registrado como prova.",
              ].join("\n")
            )
          );

      const warningMessage =
        await message.channel.send({
          components: [warningContainer],
          flags: MessageFlags.IsComponentsV2,
        });

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

  const attachments =
    Array.from(
      message.attachments.values()
    );

  if (
    attachments.length === 0
  ) {
    return;
  }

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

  const proofCount =
    await prisma.ticketProof.count({
      where: {
        ticketId: ticket.id,
      },
    });

  const firstProof =
    existingProofCount === 0;

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

  console.log(
    "📎 [TICKET] Nova prova adicionada:",
    {
      ticketId: ticket.id,
      totalProofs: proofCount,
    }
  );
}

export async function buildTicketAnalysisContainer(
  message: Message,
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
    console.warn(
      "⚠️ [TICKET] Ticket não encontrado:",
      ticketId
    );

    return;
  }

  const proofCount =
    await prisma.ticketProof.count({
      where: {
        ticketId: ticket.id,
      },
    });

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

  const container =
    new ContainerBuilder()
      .setAccentColor(0x3498db)
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
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )
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
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
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
          .setSpacing(SeparatorSpacingSize.Small)
      )
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
          );

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

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        closeButton
      )
  );

  for (
    const ticketMedal of ticket.medals
  ) {
    if (
      ticketMedal.status !==
      "PENDING"
    ) {
      continue;
    }

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
  }

  try {
    const channel = message.channel;

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

    const botUserId =
      message.client.user?.id;

    if (!botUserId) {
      console.warn(
        "⚠️ [TICKET] Usuário do Atlas não identificado."
      );

      return;
    }

    const messages =
      await channel.messages.fetch({
        limit: 50,
      });

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

    await botMessage.edit({
      content: null,
      embeds: [],
      components: [
        container,
      ],
      flags: MessageFlags.IsComponentsV2,
    });

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