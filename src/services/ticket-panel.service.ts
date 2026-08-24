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

function createTicketPanelComponents() {
  const requestButton =
    new ButtonBuilder()
      .setCustomId(
        "ticket_request_medals"
      )
      .setLabel(
        "Solicitar medalhas"
      )
      .setEmoji("🎖️")
      .setStyle(
        ButtonStyle.Primary
      );

  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(requestButton);
}

function createTicketPanelContainer(): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(0x3498db)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "# 🎖️ Solicitação de Medalhas",
          "",
          "Deseja solicitar uma ou mais medalhas?",
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
          "## 📋 Como funciona",
          "",
          "Clique no botão abaixo para iniciar sua solicitação.",
          "",
          "🎖️ Você poderá solicitar de **1 a 3 medalhas** no mesmo ticket.",
          "🔎 Cada medalha será analisada individualmente pela equipe responsável.",
          "⚖️ A decisão de aprovação ou negativa será registrada no ticket.",
          "🏅 Após a aprovação, a medalha será efetivamente entregue no servidor do EB.",
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
          "## 📎 Antes de começar",
          "",
          "Tenha em mãos as provas necessárias para comprovar o direito às medalhas solicitadas.",
          "",
          "-# O Atlas utilizará as informações e provas enviadas no ticket para realizar a análise.",
        ].join("\n")
      )
    )
    .addActionRowComponents(
      createTicketPanelComponents()
    );
}

// ==========================================================
// CRIA PAINEL
// ==========================================================

export async function createTicketPanel(
  guild: Guild,
  channelId: string
): Promise<string | null> {
  const channel =
    await guild.channels.fetch(
      channelId
    );

  if (
    !channel ||
    !channel.isTextBased()
  ) {
    throw new Error(
      "O canal configurado para o painel não foi encontrado ou não é um canal de texto."
    );
  }

  const config =
    await prisma.guildConfig.findUnique({
      where: {
        requestGuildId:
          guild.id,
      },
    });

  if (!config) {
    throw new Error(
      "O servidor ainda não possui uma configuração do Atlas."
    );
  }

  const components = [
    createTicketPanelContainer(),
  ];

  if (
    config.ticketPanelMessageId
  ) {
    try {
      const existingMessage =
        await channel.messages.fetch(
          config.ticketPanelMessageId
        );

      await existingMessage.edit({
        content: null,
        embeds: [],
        components,
        flags: MessageFlags.IsComponentsV2,
      });

      await prisma.guildConfig.update({
        where: {
          requestGuildId:
            guild.id,
        },
        data: {
          ticketPanelChannelId:
            channel.id,
          ticketPanelMessageId:
            existingMessage.id,
        },
      });

      console.log(
        "🟢 [TICKET PANEL] Painel existente atualizado:",
        existingMessage.id
      );

      return existingMessage.id;
    } catch {
      console.log(
        "⚠️ [TICKET PANEL] Painel anterior não foi encontrado. Criando um novo."
      );
    }
  }

  const message =
    await channel.send({
      components,
      flags: MessageFlags.IsComponentsV2,
    });

  await prisma.guildConfig.update({
    where: {
      requestGuildId:
        guild.id,
    },
    data: {
      ticketPanelChannelId:
        channel.id,
      ticketPanelMessageId:
        message.id,
    },
  });

  console.log(
    "🟢 [TICKET PANEL] Painel criado:",
    message.id
  );

  return message.id;
}

// ==========================================================
// ATUALIZA PAINEL EXISTENTE
// ==========================================================

export async function updateTicketPanel(
  guild: Guild
): Promise<boolean> {
  const config =
    await prisma.guildConfig.findUnique({
      where: {
        requestGuildId:
          guild.id,
      },
    });

  if (
    !config ||
    !config.ticketPanelChannelId ||
    !config.ticketPanelMessageId
  ) {
    return false;
  }

  const channel =
    await guild.channels.fetch(
      config.ticketPanelChannelId
    );

  if (
    !channel ||
    !channel.isTextBased()
  ) {
    return false;
  }

  try {
    const message =
      await channel.messages.fetch(
        config.ticketPanelMessageId
      );

    await message.edit({
      content: null,
      embeds: [],
      components: [
        createTicketPanelContainer(),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    console.log(
      "🟢 [TICKET PANEL] Painel atualizado:",
      message.id
    );

    return true;
  } catch (error) {
    console.error(
      "❌ [TICKET PANEL] Erro ao atualizar painel:",
      error
    );

    return false;
  }
}