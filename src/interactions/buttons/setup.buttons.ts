import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
  ModalSubmitInteraction,
} from "discord.js";

import {
  getSetupData,
  saveGuildConfig,
  updateSetupData,
} from "../../services/setup.service.js";

// ==========================================================
// SETUP — BOTÕES
// ==========================================================

export async function handleSetupButton(
  interaction: ButtonInteraction
): Promise<void> {
  if (!interaction.guild) {
    return;
  }

  // ========================================================
  // SERVIDOR DE ENTREGA
  // ========================================================

  if (
    interaction.customId ===
    "setup_delivery_guild"
  ) {
    const modal =
      new ModalBuilder()
        .setCustomId(
          "setup_delivery_guild_modal"
        )
        .setTitle(
          "🏰 Servidor de entrega"
        );

    const guildIdInput =
      new TextInputBuilder()
        .setCustomId(
          "delivery_guild_id"
        )
        .setLabel(
          "ID do servidor de entrega"
        )
        .setPlaceholder(
          "Ex.: 123456789012345678"
        )
        .setStyle(
          TextInputStyle.Short
        )
        .setRequired(true)
        .setMinLength(17)
        .setMaxLength(20);

    const row =
      new ActionRowBuilder<TextInputBuilder>()
        .addComponents(
          guildIdInput
        );

    modal.addComponents(row);

    await interaction.showModal(
      modal
    );

    return;
  }

  // ========================================================
  // SALVAR CONFIGURAÇÃO
  // ========================================================

  if (
    interaction.customId !==
    "setup_save"
  ) {
    return;
  }

  const guildId =
    interaction.guild.id;

  const data =
    getSetupData(guildId);

  // ========================================================
  // VERIFICA CAMPOS OBRIGATÓRIOS
  // ========================================================

  const missing: string[] = [];

  if (!data.staffRoleId) {
    missing.push(
      "🛡️ Cargo da equipe de medalhas"
    );
  }

  if (!data.ticketCategoryId) {
    missing.push(
      "📁 Categoria de tickets"
    );
  }

  if (!data.ticketPanelChannelId) {
    missing.push(
      "🎫 Canal do painel de tickets"
    );
  }

  if (!data.medalCatalogChannelId) {
    missing.push(
      "🏅 Canal do catálogo de medalhas"
    );
  }

  if (!data.logChannelId) {
    missing.push(
      "📋 Canal de logs"
    );
  }

  if (!data.transcriptChannelId) {
    missing.push(
      "📄 Canal de transcripts"
    );
  }

  if (!data.deliveryGuildId) {
    missing.push(
      "🏰 Servidor de entrega"
    );
  }

  // ========================================================
  // CARGO DOS RESPONSÁVEIS
  // ========================================================
  //
  // IMPORTANTE:
  //
  // staffRoleId:
  //   Equipe que atende e analisa tickets.
  //
  // responsibleRoleId:
  //   Superiores/responsáveis pelo setor.
  //
  // Não tratamos os dois como o mesmo cargo.
  //
  // A validação abaixo será ativada quando o campo
  // responsibleRoleId estiver presente no SetupData.
  //
  // ========================================================

  if (
    "responsibleRoleId" in data &&
    !data.responsibleRoleId
  ) {
    missing.push(
      "👑 Cargo dos responsáveis do setor"
    );
  }

  // ========================================================
  // CONFIGURAÇÃO INCOMPLETA
  // ========================================================

  if (
    missing.length > 0
  ) {
    await interaction.reply({
      content: [
        "## ⚙️ Configuração incompleta",
        "",
        "O Atlas ainda não pode salvar a configuração porque existem campos obrigatórios pendentes.",
        "",
        "### Campos pendentes",
        "",
        ...missing.map(
          (item) =>
            `• ${item}`
        ),
      ].join("\n"),

      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // SALVAR
  // ========================================================

  try {
    await saveGuildConfig(
      guildId,
      data
    );

    await interaction.reply({
      content: [
        "## ✅ Configuração atualizada",
        "",
        "As configurações do Atlas foram salvas com sucesso.",
        "",
        "As configurações anteriores que não foram alteradas foram preservadas.",
      ].join("\n"),

      flags:
        MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error(
      "❌ [SETUP] Erro ao salvar configuração do Atlas:",
      error
    );

    await interaction.reply({
      content: [
        "## ❌ Não foi possível salvar",
        "",
        "Ocorreu um erro ao salvar a configuração do Atlas.",
        "",
        "-# Verifique o console para obter mais informações.",
      ].join("\n"),

      flags:
        MessageFlags.Ephemeral,
    });
  }
}

// ==========================================================
// MODAL — SERVIDOR DE ENTREGA
// ==========================================================

export async function handleSetupDeliveryGuildModal(
  interaction: ModalSubmitInteraction
): Promise<void> {
  if (
    interaction.customId !==
    "setup_delivery_guild_modal"
  ) {
    return;
  }

  if (!interaction.guild) {
    await interaction.reply({
      content: [
        "## ❌ Ação indisponível",
        "",
        "Esta configuração só pode ser utilizada dentro de um servidor.",
      ].join("\n"),

      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // LÊ ID
  // ========================================================

  const deliveryGuildId =
    interaction.fields
      .getTextInputValue(
        "delivery_guild_id"
      )
      .trim();

  // ========================================================
  // VALIDA ID
  // ========================================================

  if (
    !/^\d{17,20}$/.test(
      deliveryGuildId
    )
  ) {
    await interaction.reply({
      content: [
        "## ❌ ID inválido",
        "",
        "Informe um ID numérico válido de servidor Discord.",
      ].join("\n"),

      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // VERIFICA SERVIDOR
  // ========================================================

  let deliveryGuild;

  try {
    deliveryGuild =
      await interaction.client.guilds.fetch(
        deliveryGuildId
      );
  } catch {
    deliveryGuild =
      null;
  }

  if (!deliveryGuild) {
    await interaction.reply({
      content: [
        "## ❌ Servidor não encontrado",
        "",
        "O Atlas precisa estar presente no servidor de entrega antes que ele possa ser configurado.",
        "",
        `ID informado: \`${deliveryGuildId}\``,
      ].join("\n"),

      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // ATUALIZA CONFIGURAÇÃO TEMPORÁRIA
  // ========================================================

  updateSetupData(
    interaction.guild.id,
    {
      deliveryGuildId,
    }
  );

  // ========================================================
  // CONFIRMA
  // ========================================================

  await interaction.reply({
    content: [
      "## 🏰 Servidor de entrega atualizado",
      "",
      `**Servidor:** ${deliveryGuild.name}`,
      `**ID:** \`${deliveryGuild.id}\``,
      "",
      "A alteração foi armazenada temporariamente.",
      "",
      "Clique em **Salvar configuração** no painel do `/setup` para confirmar definitivamente.",
    ].join("\n"),

    flags:
      MessageFlags.Ephemeral,
  });
}