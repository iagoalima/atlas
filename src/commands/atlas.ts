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
      .setDescription("Publica ou atualiza o Dashboard do Atlas.")
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ Este comando só pode ser usado em um servidor.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);

  if (!member.permissions.has("Administrator")) {
    await interaction.reply({
      content: "❌ Apenas administradores podem publicar o Dashboard do Atlas.",
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
        "## ⚙️ Atlas não configurado\n\nConclua o `/setup` antes de publicar o Dashboard.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channelId = config.dashboardChannelId;

  if (!channelId) {
    await interaction.reply({
      content:
        "## ⚙️ Canal do Dashboard não configurado\n\nSelecione o canal do Dashboard pelo `/setup` antes de publicar o painel.",
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
        "## 🟢 Dashboard atualizado",
        "",
        `O Dashboard está disponível em <#${channelId}>.`,
        "",
        `-# Mensagem: \`${messageId}\``,
      ].join("\n"),
    });
  } catch (error) {
    console.error("❌ [ATLAS DASHBOARD] Erro:", error);

    await interaction.editReply({
      content: [
        "## ❌ Não foi possível atualizar o Dashboard",
        "",
        error instanceof Error
          ? error.message
          : "Verifique a configuração e as permissões do Atlas.",
      ].join("\n"),
    });
  }
}
