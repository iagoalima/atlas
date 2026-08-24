import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

import { prisma } from "../infrastructure/database/prisma.js";

import {
  createTicketPanel,
} from "../services/ticket-panel.service.js";

export const data =
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription(
      "Gerencia o sistema de tickets."
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("painel")
        .setDescription(
          "Publica o painel de solicitação de medalhas."
        )
    );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  // ======================================================
  // VERIFICA SERVIDOR
  // ======================================================

  if (!interaction.guild) {
    await interaction.reply({
      content:
        "❌ Este comando só pode ser usado em um servidor.",
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ======================================================
  // VERIFICA ADMINISTRADOR
  // ======================================================

  const member =
    await interaction.guild.members.fetch(
      interaction.user.id
    );

  if (
    !member.permissions.has(
      "Administrator"
    )
  ) {
    await interaction.reply({
      content:
        "❌ Apenas administradores podem gerenciar o sistema de tickets.",
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ======================================================
  // SUBCOMANDO
  // ======================================================

  const subcommand =
    interaction.options.getSubcommand();

  if (
    subcommand !== "painel"
  ) {
    return;
  }

  console.log(
    "🎫 [TICKET] Publicação do painel solicitada por:",
    interaction.user.tag
  );

  // ======================================================
  // BUSCA CONFIGURAÇÃO
  // ======================================================

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
        "❌ **O Atlas ainda não foi configurado.**",
        "",
        "Utilize `/setup` antes de publicar o painel de tickets.",
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ======================================================
  // VERIFICA CANAL
  // ======================================================

  if (
    !config.ticketPanelChannelId
  ) {
    await interaction.reply({
      content: [
        "❌ **Canal do painel não configurado.**",
        "",
        "Abra `/setup` e selecione o canal público onde o painel de solicitação será publicado.",
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ======================================================
  // DEFER
  // ======================================================

  await interaction.deferReply({
    flags:
      MessageFlags.Ephemeral,
  });

  // ======================================================
  // PUBLICA / ATUALIZA PAINEL
  // ======================================================

  try {
    const messageId =
      await createTicketPanel(
        interaction.guild,
        config.ticketPanelChannelId
      );

    if (!messageId) {
      await interaction.editReply({
        content:
          "❌ Não foi possível publicar o painel de solicitação de medalhas.",
      });

      return;
    }

    await interaction.editReply({
      content: [
        "## ✅ Painel publicado!",
        "",
        `🎖️ Canal: <#${config.ticketPanelChannelId}>`,
        `🆔 Mensagem: \`${messageId}\``,
        "",
        "O painel público de solicitação de medalhas está ativo.",
      ].join("\n"),
    });

    console.log(
      "🟢 [TICKET] Painel publicado:",
      messageId
    );
  } catch (error) {
    console.error(
      "❌ [TICKET] Erro ao publicar painel:",
      error
    );

    await interaction.editReply({
      content: [
        "❌ **Não foi possível publicar o painel.**",
        "",
        "Verifique as permissões do Atlas no canal configurado e consulte o console para mais detalhes.",
      ].join("\n"),
    });
  }
}