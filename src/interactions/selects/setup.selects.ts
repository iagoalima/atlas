import {
  ChannelSelectMenuInteraction,
  RoleSelectMenuInteraction,
} from "discord.js";

import {
  updateSetupData,
} from "../../services/setup.service.js";

export async function handleSetupSelect(
  interaction:
    | RoleSelectMenuInteraction
    | ChannelSelectMenuInteraction
): Promise<void> {
  if (!interaction.guild) {
    return;
  }

  const guildId =
    interaction.guild.id;

  // ======================================================
  // SELECTS DE CARGOS
  // ======================================================

  if (
    interaction.isRoleSelectMenu()
  ) {
    const role =
      interaction.roles.first();

    if (!role) {
      await interaction.reply({
        content:
          "❌ Nenhum cargo foi selecionado.",
        flags: 64,
      });

      return;
    }

    // ====================================================
    // CARGO DA EQUIPE
    // ====================================================

    if (
      interaction.customId ===
      "setup_staff_role"
    ) {
      updateSetupData(
        guildId,
        {
          staffRoleId:
            role.id,
        }
      );

      await interaction.reply({
        content:
          `🛡️ Cargo da equipe selecionado: <@&${role.id}>`,
        flags: 64,
      });

      return;
    }

    // ====================================================
    // CARGO DOS RESPONSÁVEIS
    // ====================================================

    if (
      interaction.customId ===
      "setup_responsible_role"
    ) {
      updateSetupData(
        guildId,
        {
          responsibleRoleId:
            role.id,
        }
      );

      await interaction.reply({
        content:
          `👑 Cargo dos responsáveis selecionado: <@&${role.id}>`,
        flags: 64,
      });

      return;
    }

    return;
  }

  // ======================================================
  // SELECTS DE CANAIS
  // ======================================================

  if (
    !interaction.isChannelSelectMenu()
  ) {
    return;
  }

  const channel =
    interaction.channels.first();

  if (!channel) {
    await interaction.reply({
      content:
        "❌ Nenhum canal foi selecionado.",
      flags: 64,
    });

    return;
  }

  // ======================================================
  // CATEGORIA DE TICKETS
  // ======================================================

  switch (
    interaction.customId
  ) {
    case "setup_ticket_category":
      updateSetupData(
        guildId,
        {
          ticketCategoryId:
            channel.id,
        }
      );

      await interaction.reply({
        content:
          `📁 Categoria selecionada: <#${channel.id}>`,
        flags: 64,
      });

      return;

    // ====================================================
    // LOGS
    // ====================================================

    case "setup_log_channel":
      updateSetupData(
        guildId,
        {
          logChannelId:
            channel.id,
        }
      );

      await interaction.reply({
        content:
          `📋 Canal de logs selecionado: <#${channel.id}>`,
        flags: 64,
      });

      return;

    // ====================================================
    // TRANSCRIPTS
    // ====================================================

    case "setup_transcript_channel":
      updateSetupData(
        guildId,
        {
          transcriptChannelId:
            channel.id,
        }
      );

      await interaction.reply({
        content:
          `📄 Canal de transcripts selecionado: <#${channel.id}>`,
        flags: 64,
      });

      return;

    // ====================================================
    // PAINEL DE TICKETS
    // ====================================================

    case "setup_ticket_panel_channel":
      updateSetupData(
        guildId,
        {
          ticketPanelChannelId:
            channel.id,
        }
      );

      await interaction.reply({
        content:
          `🎫 Canal do painel selecionado: <#${channel.id}>`,
        flags: 64,
      });

      return;

      case "setup_medal_catalog_channel":
  updateSetupData(
    guildId,
    {
      medalCatalogChannelId:
        channel.id,
    }
  );

  await interaction.reply({
    content:
      `🏅 Canal do catálogo selecionado: <#${channel.id}>`,
    flags: 64,
  });

  return;

  }
}