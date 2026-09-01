import { ChannelSelectMenuInteraction, RoleSelectMenuInteraction } from "discord.js";
import { updateSetupData } from "../../services/setup.service.js";

export async function handleSetupSelect(interaction: RoleSelectMenuInteraction | ChannelSelectMenuInteraction): Promise<void> {
  if (!interaction.guild) return;
  const guildId = interaction.guild.id;

  if (interaction.isRoleSelectMenu()) {
    const role = interaction.roles.first();
    if (!role) return;
    const field = interaction.customId === "setup_staff_role" ? "staffRoleId" : interaction.customId === "setup_responsible_role" ? "responsibleRoleId" : null;
    if (!field) return;
    updateSetupData(guildId, { [field]: role.id });
    await interaction.reply({ content: field === "staffRoleId" ? `🛡️ Cargo da equipe selecionado: <@&${role.id}>` : `👑 Cargo dos responsáveis selecionado: <@&${role.id}>`, flags: 64 });
    return;
  }

  const channel = interaction.channels.first();
  if (!channel) return;

  const fields: Record<string, string> = {
    setup_log_channel: "logChannelId",
    setup_request_panel_channel: "requestPanelChannelId",
    setup_request_review_channel: "requestReviewChannelId",
    setup_medal_catalog_channel: "medalCatalogChannelId",
  };
  const field = fields[interaction.customId];
  if (!field) return;

  updateSetupData(guildId, { [field]: channel.id });
  const labels: Record<string, string> = {
    logChannelId: "📋 Canal de logs",
    requestPanelChannelId: "📢 Painel público",
    requestReviewChannelId: "🔐 Canal privado de análise",
    medalCatalogChannelId: "🏅 Catálogo de medalhas",
  };
  await interaction.reply({ content: `${labels[field]} selecionado: <#${channel.id}>`, flags: 64 });
}
