import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  MessageFlags,
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
} from "discord.js";

import {
  createContainer,
  createSeparator,
  createText,
} from "../ui/components.js";

import { prisma } from "../infrastructure/database/prisma.js";

import {
  updateSetupData,
} from "../services/setup.service.js";

// ==========================================================
// COMANDO
// ==========================================================

export const data =
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription(
      "Configura o Atlas neste servidor."
    );

// ==========================================================
// EXECUÇÃO
// ==========================================================

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  // ======================================================
  // VERIFICA SERVIDOR
  // ======================================================

  if (
    !interaction.guild ||
    !interaction.member
  ) {
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
        "❌ Apenas administradores podem configurar o Atlas.",

      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ======================================================
  // BUSCA CONFIGURAÇÃO ATUAL
  // ======================================================

  const config =
    await prisma.guildConfig.findUnique({
      where: {
        requestGuildId:
          interaction.guild.id,
      },
    });

  // ======================================================
  // CARREGA CONFIGURAÇÃO NA SESSÃO
  // ======================================================

  if (config) {
    updateSetupData(
      interaction.guild.id,
      {
        ...(config.staffRoleId
          ? {
            staffRoleId:
              config.staffRoleId,
          }
          : {}),

        ...(config.responsibleRoleId
          ? {
            responsibleRoleId:
              config.responsibleRoleId,
          }
          : {}),

        ...(config.ticketCategoryId
          ? {
            ticketCategoryId:
              config.ticketCategoryId,
          }
          : {}),

        ...(config.logChannelId
          ? {
            logChannelId:
              config.logChannelId,
          }
          : {}),

        ...(config.transcriptChannelId
          ? {
            transcriptChannelId:
              config.transcriptChannelId,
          }
          : {}),

        ...(config.deliveryGuildId
          ? {
            deliveryGuildId:
              config.deliveryGuildId,
          }
          : {}),

        ...(config.medalCatalogChannelId
          ? {
            medalCatalogChannelId:
              config.medalCatalogChannelId,
          }
          : {}),

        ...(config.medalCatalogMessageId
          ? {
            medalCatalogMessageId:
              config.medalCatalogMessageId,
          }
          : {}),

        ...(config.ticketPanelChannelId
          ? {
            ticketPanelChannelId:
              config.ticketPanelChannelId,
          }
          : {}),

        ...(config.ticketPanelMessageId
          ? {
            ticketPanelMessageId:
              config.ticketPanelMessageId,
          }
          : {}),
      }
    );
  }

  // ======================================================
  // VALORES ATUAIS
  // ======================================================

  const staffRoleText =
    config?.staffRoleId
      ? `<@&${config.staffRoleId}>`
      : "Não configurado";

  const responsibleRoleText =
    config?.responsibleRoleId
      ? `<@&${config.responsibleRoleId}>`
      : "Não configurado";

  const ticketCategoryText =
    config?.ticketCategoryId
      ? `<#${config.ticketCategoryId}>`
      : "Não configurada";

  const logChannelText =
    config?.logChannelId
      ? `<#${config.logChannelId}>`
      : "Não configurado";

  const transcriptChannelText =
    config?.transcriptChannelId
      ? `<#${config.transcriptChannelId}>`
      : "Não configurado";

  const ticketPanelChannelText =
    config?.ticketPanelChannelId
      ? `<#${config.ticketPanelChannelId}>`
      : "Não configurado";

  const medalCatalogChannelText =
    config?.medalCatalogChannelId
      ? `<#${config.medalCatalogChannelId}>`
      : "Não configurado";

  // ======================================================
  // SERVIDOR DE ENTREGA — VALOR ATUAL
  // ======================================================

  let deliveryGuildText =
    "Não configurado";

  if (
    config?.deliveryGuildId
  ) {
    const deliveryGuild =
      interaction.client.guilds.cache.get(
        config.deliveryGuildId
      );

    deliveryGuildText =
      deliveryGuild
        ? deliveryGuild.name
        : "Servidor não encontrado";
  }

  // ======================================================
  // CARGO DA EQUIPE
  // ======================================================

  const roleSelect =
    new RoleSelectMenuBuilder()
      .setCustomId(
        "setup_staff_role"
      )
      .setPlaceholder(
        "Selecionar cargo da equipe"
      )
      .setMinValues(1)
      .setMaxValues(1);

  const roleRow =
    new ActionRowBuilder<
      RoleSelectMenuBuilder
    >().addComponents(
      roleSelect
    );

  // ======================================================
  // CARGO DOS RESPONSÁVEIS
  // ======================================================

  const responsibleRoleSelect =
    new RoleSelectMenuBuilder()
      .setCustomId(
        "setup_responsible_role"
      )
      .setPlaceholder(
        "Selecionar cargo dos responsáveis"
      )
      .setMinValues(1)
      .setMaxValues(1);

  const responsibleRoleRow =
    new ActionRowBuilder<
      RoleSelectMenuBuilder
    >().addComponents(
      responsibleRoleSelect
    );

  // ======================================================
  // CATEGORIA DOS TICKETS
  // ======================================================

  const categorySelect =
    new ChannelSelectMenuBuilder()
      .setCustomId(
        "setup_ticket_category"
      )
      .setPlaceholder(
        "Selecionar categoria dos tickets"
      )
      .setChannelTypes(
        ChannelType.GuildCategory
      )
      .setMinValues(1)
      .setMaxValues(1);

  const categoryRow =
    new ActionRowBuilder<
      ChannelSelectMenuBuilder
    >().addComponents(
      categorySelect
    );

  // ======================================================
  // CANAL DE LOGS
  // ======================================================

  const logsSelect =
    new ChannelSelectMenuBuilder()
      .setCustomId(
        "setup_log_channel"
      )
      .setPlaceholder(
        "Selecionar canal de logs"
      )
      .setChannelTypes(
        ChannelType.GuildText
      )
      .setMinValues(1)
      .setMaxValues(1);

  const logsRow =
    new ActionRowBuilder<
      ChannelSelectMenuBuilder
    >().addComponents(
      logsSelect
    );

  // ======================================================
  // CANAL DE TRANSCRIPTS
  // ======================================================

  const transcriptsSelect =
    new ChannelSelectMenuBuilder()
      .setCustomId(
        "setup_transcript_channel"
      )
      .setPlaceholder(
        "Selecionar canal de transcripts"
      )
      .setChannelTypes(
        ChannelType.GuildText
      )
      .setMinValues(1)
      .setMaxValues(1);

  const transcriptsRow =
    new ActionRowBuilder<
      ChannelSelectMenuBuilder
    >().addComponents(
      transcriptsSelect
    );

  // ======================================================
  // CANAL DO PAINEL DE TICKETS
  // ======================================================

  const ticketPanelSelect =
    new ChannelSelectMenuBuilder()
      .setCustomId(
        "setup_ticket_panel_channel"
      )
      .setPlaceholder(
        "Selecionar canal do painel"
      )
      .setChannelTypes(
        ChannelType.GuildText
      )
      .setMinValues(1)
      .setMaxValues(1);

  const ticketPanelRow =
    new ActionRowBuilder<
      ChannelSelectMenuBuilder
    >().addComponents(
      ticketPanelSelect
    );

  // ======================================================
  // CANAL DO CATÁLOGO DE MEDALHAS
  // ======================================================

  const medalCatalogSelect =
    new ChannelSelectMenuBuilder()
      .setCustomId(
        "setup_medal_catalog_channel"
      )
      .setPlaceholder(
        "Selecionar canal do catálogo de medalhas"
      )
      .setChannelTypes(
        ChannelType.GuildText
      )
      .setMinValues(1)
      .setMaxValues(1);

  const medalCatalogRow =
    new ActionRowBuilder<
      ChannelSelectMenuBuilder
    >().addComponents(
      medalCatalogSelect
    );

  // ======================================================
  // SERVIDOR DE ENTREGA
  // ======================================================

  const deliveryButton =
    new ButtonBuilder()
      .setCustomId(
        "setup_delivery_guild"
      )
      .setLabel(
        "Alterar servidor de entrega"
      )
      .setStyle(
        ButtonStyle.Secondary
      );

  const deliveryRow =
    new ActionRowBuilder<
      ButtonBuilder
    >().addComponents(
      deliveryButton
    );

  // ======================================================
  // BOTÃO SALVAR
  // ======================================================

  const saveButton =
    new ButtonBuilder()
      .setCustomId(
        "setup_save"
      )
      .setLabel(
        "Salvar configuração"
      )
      .setStyle(
        ButtonStyle.Success
      );

  const saveRow =
    new ActionRowBuilder<
      ButtonBuilder
    >().addComponents(
      saveButton
    );

  // ======================================================
  // CONTAINER
  // ======================================================

  const container =
    createContainer()

      // ==================================================
      // CABEÇALHO
      // ==================================================

      .addTextDisplayComponents(
        createText(
          [
            "# 🪖 ATLAS — CONFIGURAÇÃO",
            "",
            "Configure os elementos utilizados pelo sistema de tickets e pelo gerenciamento de medalhas.",
          ].join("\n")
        )
      )

      // ==================================================
      // CARGO DA EQUIPE
      // ==================================================

      .addSeparatorComponents(
        createSeparator()
      )

      .addTextDisplayComponents(
        createText(
          [
            "### 🛡️ Cargo da equipe",
            "-# Cargo responsável pelo atendimento e análise das solicitações.",
            `-# Atual: ${staffRoleText}`,
          ].join("\n")
        )
      )

      .addActionRowComponents(
        roleRow
      )

      // ==================================================
      // CARGO DOS RESPONSÁVEIS
      // ==================================================

      .addSeparatorComponents(
        createSeparator()
      )

      .addTextDisplayComponents(
        createText(
          [
            "### 👑 Cargo dos responsáveis",
            "-# Cargo dos superiores e responsáveis pelo setor de medalhas.",
            `-# Atual: ${responsibleRoleText}`,
          ].join("\n")
        )
      )

      .addActionRowComponents(
        responsibleRoleRow
      )

      // ==================================================
      // CATEGORIA
      // ==================================================

      .addSeparatorComponents(
        createSeparator()
      )

      .addTextDisplayComponents(
        createText(
          [
            "### 📁 Categoria de tickets",
            "-# Categoria onde os tickets de solicitação serão criados.",
            `-# Atual: ${ticketCategoryText}`,
          ].join("\n")
        )
      )

      .addActionRowComponents(
        categoryRow
      )

      // ==================================================
      // LOGS
      // ==================================================

      .addSeparatorComponents(
        createSeparator()
      )

      .addTextDisplayComponents(
        createText(
          [
            "### 📋 Canal de logs",
            "-# Canal onde o Atlas registrará as ações administrativas.",
            `-# Atual: ${logChannelText}`,
          ].join("\n")
        )
      )

      .addActionRowComponents(
        logsRow
      )

      // ==================================================
      // TRANSCRIPTS
      // ==================================================

      .addSeparatorComponents(
        createSeparator()
      )

      .addTextDisplayComponents(
        createText(
          [
            "### 📄 Canal de transcripts",
            "-# Canal onde serão armazenados os transcripts dos tickets.",
            `-# Atual: ${transcriptChannelText}`,
          ].join("\n")
        )
      )

      .addActionRowComponents(
        transcriptsRow
      )

      // ==================================================
      // PAINEL DE TICKETS
      // ==================================================

      .addSeparatorComponents(
        createSeparator()
      )

      .addTextDisplayComponents(
        createText(
          [
            "### 🎫 Painel de solicitações",
            "-# Canal público onde militares e civis poderão iniciar uma solicitação de medalhas.",
            `-# Atual: ${ticketPanelChannelText}`,
          ].join("\n")
        )
      )

      .addActionRowComponents(
        ticketPanelRow
      )

      // ==================================================
      // CATÁLOGO DE MEDALHAS
      // ==================================================

      .addSeparatorComponents(
        createSeparator()
      )

      .addTextDisplayComponents(
        createText(
          [
            "### 🏅 Catálogo de medalhas",
            "-# Canal onde o Atlas publicará e manterá atualizado o catálogo de medalhas.",
            `-# Atual: ${medalCatalogChannelText}`,
          ].join("\n")
        )
      )

      .addActionRowComponents(
        medalCatalogRow
      )

      // ==================================================
      // SERVIDOR DE ENTREGA
      // ==================================================

      .addSeparatorComponents(
        createSeparator()
      )

      .addTextDisplayComponents(
        createText(
          [
            "### 🏰 Servidor de entrega",
            "-# Servidor onde as medalhas serão efetivamente concedidas.",
            `-# Atual: ${deliveryGuildText}`,
          ].join("\n")
        )
      )

      .addActionRowComponents(
        deliveryRow
      )

      // ==================================================
      // SALVAR
      // ==================================================

      .addSeparatorComponents(
        createSeparator()
      )

      .addTextDisplayComponents(
        createText(
          [
            "-# Quando terminar, salve as alterações realizadas.",
          ].join("\n")
        )
      )

      .addActionRowComponents(
        saveRow
      );

  // ======================================================
  // ENVIA PAINEL
  // ======================================================

  await interaction.reply({
    flags:
      MessageFlags.IsComponentsV2,

    components: [
      container,
    ],
  });
}