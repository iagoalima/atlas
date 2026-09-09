import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { prisma } from "../infrastructure/database/prisma.js";
import { createAtlasDashboard } from "../services/atlas-dashboard.service.js";
import { publishAnalysisDashboard } from "../services/analysis-dashboard.service.js";

export const data = new SlashCommandBuilder()
  .setName("atlas")
  .setDescription("Gerencia os painéis principais do Atlas.")
  .addSubcommand((s) => s.setName("dashboard").setDescription("Publica ou atualiza o dashboard público."))
  .addSubcommand((s) => s.setName("analise").setDescription("Publica uma nova central interna de análise."));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Este comando só pode ser usado em um servidor.", flags: MessageFlags.Ephemeral });
    return;
  }
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.permissions.has("Administrator")) {
    await interaction.reply({ content: "❌ Apenas administradores podem publicar os painéis do Atlas.", flags: MessageFlags.Ephemeral });
    return;
  }

  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: interaction.guild.id } });
  if (!config) {
    await interaction.reply({ content: "## ⚙️ Atlas não configurado\n\nConclua o `/setup` antes de publicar os painéis.", flags: MessageFlags.Ephemeral });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    if (subcommand === "dashboard") {
      const channelId = config.dashboardChannelId ?? config.requestPanelChannelId;
      if (!channelId) throw new Error("Configure o canal do dashboard no /setup ou use o canal do painel público.");
      const messageId = await createAtlasDashboard(interaction.guild, channelId);
      await interaction.editReply({ content: `## 🟢 Dashboard atualizado\n\nO dashboard do Atlas está disponível em <#${channelId}>.\n\n-# Mensagem: \`${messageId}\`` });
      return;
    }

    const channelId = config.requestReviewChannelId;
    if (!channelId) throw new Error("Configure o canal privado de análise no /setup.");
    const messageId = await publishAnalysisDashboard(interaction.guild, channelId);
    await interaction.editReply({ content: `## 🟢 Central de análise publicada\n\nA nova central foi criada em <#${channelId}>.\n\n-# Mensagem: \`${messageId}\`` });
  } catch (error) {
    console.error("❌ [ATLAS PANEL] Erro:", error);
    await interaction.editReply({ content: `## ❌ Não foi possível publicar\n\n${error instanceof Error ? error.message : "Verifique a configuração e as permissões do Atlas."}` });
  }
}
