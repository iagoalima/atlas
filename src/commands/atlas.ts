import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { prisma } from "../infrastructure/database/prisma.js";
import { publishAnalysisDashboard } from "../services/analysis-dashboard.service.js";

export const data = new SlashCommandBuilder()
  .setName("atlas")
  .setDescription("Gerencia a central interna do Atlas.")
  .addSubcommand((s) =>
    s
      .setName("dashboard")
      .setDescription("Publica ou atualiza a Central Interna de Análise.")
  )
  .addSubcommand((s) =>
    s
      .setName("analise")
      .setDescription("Publica ou atualiza a Central Interna de Análise.")
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content:
        "❌ Este comando só pode ser usado em um servidor.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = await interaction.guild.members.fetch(
    interaction.user.id
  );

  if (!member.permissions.has("Administrator")) {
    await interaction.reply({
      content:
        "❌ Apenas administradores podem publicar a Central Interna de Análise.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const config = await prisma.guildConfig.findUnique({
    where: {
      requestGuildId: interaction.guild.id,
    },
  });

  if (!config) {
    await interaction.reply({
      content:
        "## ⚙️ Atlas não configurado\n\nConclua o `/setup` antes de publicar a central.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channelId = config.requestReviewChannelId;

  if (!channelId) {
    await interaction.reply({
      content:
        "## ⚙️ Canal de análise não configurado\n\nConfigure o canal privado de análise pelo `/setup` antes de publicar a central.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  try {
    const messageId = await publishAnalysisDashboard(
      interaction.guild,
      channelId
    );

    await interaction.editReply({
      content: [
        "## 🟢 Central Interna de Análise atualizada",
        "",
        `A central está disponível em <#${channelId}>.`,
        "",
        `-# Mensagem: \`${messageId}\``,
        "-# O painel não é publicado em canais públicos.",
      ].join("\n"),
    });
  } catch (error) {
    console.error("❌ [ATLAS PANEL] Erro:", error);

    await interaction.editReply({
      content: [
        "## ❌ Não foi possível atualizar a central",
        "",
        error instanceof Error
          ? error.message
          : "Verifique a configuração e as permissões do Atlas.",
      ].join("\n"),
    });
  }
}
