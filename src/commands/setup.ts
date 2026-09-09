import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, ChatInputCommandInteraction, MessageFlags, RoleSelectMenuBuilder, SlashCommandBuilder } from "discord.js";
import { createContainer, createSeparator, createText } from "../ui/components.js";
import { prisma } from "../infrastructure/database/prisma.js";
import { updateSetupData } from "../services/setup.service.js";

export const data = new SlashCommandBuilder().setName("setup").setDescription("Configura o Atlas neste servidor.");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) { await interaction.reply({ content: "❌ Este comando só pode ser usado em um servidor.", flags: MessageFlags.Ephemeral }); return; }
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.permissions.has("Administrator")) { await interaction.reply({ content: "❌ Apenas administradores podem configurar o Atlas.", flags: MessageFlags.Ephemeral }); return; }
  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: interaction.guild.id } });
  if (config) updateSetupData(interaction.guild.id, {
    staffRoleId: config.staffRoleId,
    ...(config.responsibleRoleId ? { responsibleRoleId: config.responsibleRoleId } : {}),
    logChannelId: config.logChannelId,
    ...(config.deliveryGuildId ? { deliveryGuildId: config.deliveryGuildId } : {}),
    ...(config.medalCatalogChannelId ? { medalCatalogChannelId: config.medalCatalogChannelId } : {}),
    ...(config.dashboardChannelId ? { dashboardChannelId: config.dashboardChannelId } : {}),
    ...(config.dashboardMessageId ? { dashboardMessageId: config.dashboardMessageId } : {}),
    ...(config.requestPanelChannelId ? { requestPanelChannelId: config.requestPanelChannelId } : {}),
    ...(config.requestPanelMessageId ? { requestPanelMessageId: config.requestPanelMessageId } : {}),
    ...(config.requestReviewChannelId ? { requestReviewChannelId: config.requestReviewChannelId } : {}),
    requestsOpen: config.requestsOpen,
    ticketCategoryId: config.ticketCategoryId,
    transcriptChannelId: config.transcriptChannelId,
  });

  const roleSelect = new RoleSelectMenuBuilder().setCustomId("setup_staff_role").setPlaceholder("Selecionar cargo da equipe").setMinValues(1).setMaxValues(1);
  const responsibleSelect = new RoleSelectMenuBuilder().setCustomId("setup_responsible_role").setPlaceholder("Selecionar cargo dos responsáveis").setMinValues(1).setMaxValues(1);
  const logSelect = new ChannelSelectMenuBuilder().setCustomId("setup_log_channel").setPlaceholder("Selecionar canal de logs").setChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1);
  const dashboardSelect = new ChannelSelectMenuBuilder().setCustomId("setup_dashboard_channel").setPlaceholder("Selecionar canal do dashboard").setChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1);
  const panelSelect = new ChannelSelectMenuBuilder().setCustomId("setup_request_panel_channel").setPlaceholder("Selecionar canal do painel público").setChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1);
  const reviewSelect = new ChannelSelectMenuBuilder().setCustomId("setup_request_review_channel").setPlaceholder("Selecionar canal privado da equipe").setChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1);
  const catalogSelect = new ChannelSelectMenuBuilder().setCustomId("setup_medal_catalog_channel").setPlaceholder("Selecionar canal do catálogo").setChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1);
  const deliveryButton = new ButtonBuilder().setCustomId("setup_delivery_guild").setLabel("Alterar servidor de entrega").setStyle(ButtonStyle.Secondary);
  const saveButton = new ButtonBuilder().setCustomId("setup_save").setLabel("Salvar configuração").setStyle(ButtonStyle.Success);
  const roleText = (id?: string | null) => id ? `<@&${id}>` : "Não configurado";
  const channelText = (id?: string | null) => id ? `<#${id}>` : "Não configurado";

  const container = createContainer().setAccentColor(0x1f4f78)
    .addTextDisplayComponents(createText(["# 🪖 ATLAS — CONFIGURAÇÃO", "", "Configure a estrutura visual e operacional do Atlas.", "-# O dashboard é a porta de entrada; a central de análise permanece privada para a equipe."].join("\n")))
    .addSeparatorComponents(createSeparator())
    .addTextDisplayComponents(createText(["### 🛡️ Cargo da equipe", "-# Pode analisar as solicitações.", `-# Atual: ${roleText(config?.staffRoleId)}`].join("\n")))
    .addActionRowComponents(new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect))
    .addSeparatorComponents(createSeparator())
    .addTextDisplayComponents(createText(["### 👑 Cargo dos responsáveis", "-# Superiores/responsáveis pelo setor.", `-# Atual: ${roleText(config?.responsibleRoleId)}`].join("\n")))
    .addActionRowComponents(new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(responsibleSelect))
    .addSeparatorComponents(createSeparator())
    .addTextDisplayComponents(createText(["### 🏠 Dashboard", "-# Central pública com identidade visual do Atlas.", `-# Atual: ${channelText(config?.dashboardChannelId)}`].join("\n")))
    .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(dashboardSelect))
    .addSeparatorComponents(createSeparator())
    .addTextDisplayComponents(createText(["### 📢 Solicitações", "-# Canal onde o usuário inicia uma solicitação.", `-# Atual: ${channelText(config?.requestPanelChannelId)}`].join("\n")))
    .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(panelSelect))
    .addSeparatorComponents(createSeparator())
    .addTextDisplayComponents(createText(["### 🔐 Central interna", "-# Canal privado da equipe para acompanhamento e análise.", `-# Atual: ${channelText(config?.requestReviewChannelId)}`].join("\n")))
    .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(reviewSelect))
    .addSeparatorComponents(createSeparator())
    .addTextDisplayComponents(createText(["### 🏅 Catálogo", "-# Catálogo oficial organizado por categorias.", `-# Atual: ${channelText(config?.medalCatalogChannelId)}`].join("\n")))
    .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(catalogSelect))
    .addSeparatorComponents(createSeparator())
    .addTextDisplayComponents(createText(["### 📋 Logs", "-# Registra decisões, entregas e alterações.", `-# Atual: ${channelText(config?.logChannelId)}`].join("\n")))
    .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(logSelect))
    .addSeparatorComponents(createSeparator())
    .addTextDisplayComponents(createText(["### 🏰 Servidor de entrega", `-# Atual: ${config?.deliveryGuildId ? (interaction.client.guilds.cache.get(config.deliveryGuildId)?.name ?? "Servidor não encontrado") : "Não configurado"}`].join("\n")))
    .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(deliveryButton))
    .addSeparatorComponents(createSeparator())
    .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(saveButton));

  await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [container] });
}
