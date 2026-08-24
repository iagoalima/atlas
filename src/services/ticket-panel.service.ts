import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Guild,
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

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        requestButton
      );

  return [row];
}

function getTicketPanelContent(): string {
  return [
    "# 🎖️ Solicitação de Medalhas",
    "",
    "Deseja solicitar uma ou mais medalhas?",
    "",
    "Clique no botão abaixo para iniciar sua solicitação.",
    "",
    "-# Você poderá solicitar de **1 a 3 medalhas** no mesmo ticket.",
    "-# Após a análise, cada medalha poderá ser aprovada ou negada individualmente.",
  ].join("\n");
}

// ==========================================================
// CRIA PAINEL
// ==========================================================

export async function createTicketPanel(
  guild: Guild,
  channelId: string
): Promise<string | null> {
  // ======================================================
  // BUSCA CANAL
  // ======================================================

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

  // ======================================================
  // CONFIGURAÇÃO
  // ======================================================

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

  // ======================================================
  // PAINEL
  // ======================================================

  const content =
    getTicketPanelContent();

  const components =
    createTicketPanelComponents();

  // ======================================================
  // ATUALIZA PAINEL EXISTENTE
  // ======================================================

  if (
    config.ticketPanelMessageId
  ) {
    try {
      const existingMessage =
        await channel.messages.fetch(
          config.ticketPanelMessageId
        );

      await existingMessage.edit({
        content,
        components,
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
    } catch (error) {
      console.log(
        "⚠️ [TICKET PANEL] Painel anterior não foi encontrado. Criando um novo."
      );
    }
  }

  // ======================================================
  // CRIA NOVO PAINEL
  // ======================================================

  const message =
    await channel.send({
      content,
      components,
    });

  // ======================================================
  // SALVA NO BANCO
  // ======================================================

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
      content:
        getTicketPanelContent(),

      components:
        createTicketPanelComponents(),
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