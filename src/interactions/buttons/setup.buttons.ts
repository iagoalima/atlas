import { ActionRowBuilder, ButtonInteraction, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle, MessageFlags } from "discord.js";
import { getSetupData, saveGuildConfig, updateSetupData } from "../../services/setup.service.js";

export async function handleSetupButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) return;

  if (interaction.customId === "setup_delivery_guild") {
    const modal = new ModalBuilder().setCustomId("setup_delivery_guild_modal").setTitle("Servidor de entrega");
    const input = new TextInputBuilder().setCustomId("delivery_guild_id").setLabel("ID do servidor de entrega").setPlaceholder("123456789012345678").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(17).setMaxLength(20);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
    return;
  }

  if (interaction.customId !== "setup_save") return;
  const guildId = interaction.guild.id;
  const data = getSetupData(guildId);
  const missing: string[] = [];
  if (!data.staffRoleId) missing.push("🛡️ Cargo da equipe");
  if (!data.logChannelId) missing.push("📋 Canal de logs");
  if (!data.medalCatalogChannelId) missing.push("🏅 Canal do catálogo");
  if (!data.requestPanelChannelId) missing.push("📢 Canal do painel público");
  if (!data.requestReviewChannelId) missing.push("🔐 Canal privado de análise");
  if (missing.length) {
    await interaction.reply({ content: ["## ⚙️ Configuração incompleta", "", "Configure os campos abaixo no `/setup`:", "", ...missing.map((x) => `• ${x}`)].join("\n"), flags: MessageFlags.Ephemeral });
    return;
  }
  try {
    await saveGuildConfig(guildId, data);
    await interaction.reply({ content: "## ✅ Configuração atualizada\n\nA estrutura do novo sistema de solicitações foi salva com sucesso.", flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error("❌ [SETUP] Erro ao salvar configuração:", error);
    await interaction.reply({ content: "## ❌ Não foi possível salvar\n\nVerifique os campos configurados e tente novamente.", flags: MessageFlags.Ephemeral });
  }
}

export async function handleSetupDeliveryGuildModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId !== "setup_delivery_guild_modal" || !interaction.guild) return;
  const deliveryGuildId = interaction.fields.getTextInputValue("delivery_guild_id").trim();
  if (!/^\d{17,20}$/.test(deliveryGuildId)) {
    await interaction.reply({ content: "❌ Informe um ID de servidor Discord válido.", flags: MessageFlags.Ephemeral });
    return;
  }
  const deliveryGuild = await interaction.client.guilds.fetch(deliveryGuildId).catch(() => null);
  if (!deliveryGuild) {
    await interaction.reply({ content: "❌ O Atlas precisa estar presente no servidor de entrega.", flags: MessageFlags.Ephemeral });
    return;
  }
  updateSetupData(interaction.guild.id, { deliveryGuildId });
  await interaction.reply({ content: `## 🏰 Servidor de entrega atualizado\n\n**Servidor:** ${deliveryGuild.name}\n**ID:** \`${deliveryGuild.id}\`\n\nSalve o \`/setup\` para confirmar.`, flags: MessageFlags.Ephemeral });
}
