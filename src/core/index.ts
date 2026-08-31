import { client } from "./discord/client.js";
import { env } from "../config/env.js";
import { commands, loadCommands } from "./discord/commands.js";
import { connectDatabase } from "./database.js";
import { installInteractionMessageStyle } from "../ui/interaction-messages.js";
import { cleanupSolicitationNotice } from "../services/solicitation.service.js";

client.once("clientReady", async (bot) => {
  console.log(`Atlas conectado como ${bot.user.tag}`);
  for (const guild of bot.guilds.cache.values()) await cleanupSolicitationNotice(guild).catch(() => undefined);
});

client.on("interactionCreate", async (interaction) => {
  console.log("🔔 [INTERACTION] Recebida:", {
    type: interaction.type,
    customId: "customId" in interaction ? interaction.customId : undefined,
    componentType: "componentType" in interaction ? interaction.componentType : undefined,
    isButton: interaction.isButton(),
    isRoleSelect: interaction.isRoleSelectMenu(),
    isStringSelect: interaction.isStringSelectMenu(),
    isChannelSelect: interaction.isChannelSelectMenu(),
    isModal: interaction.isModalSubmit(),
    isChatInput: interaction.isChatInputCommand(),
  });

  try {
    installInteractionMessageStyle(interaction);

    if (interaction.isButton()) {
      console.log("🔘 [INTERACTION] Botão recebido:", interaction.customId);

      if (interaction.customId.startsWith("ticket_") || interaction.customId.startsWith("solicitation_")) {
        const { handleTicketButton } = await import("../interactions/buttons/ticket.buttons.js");
        await handleTicketButton(interaction);
        return;
      }

      const { handleSetupButton } = await import("../interactions/buttons/setup.buttons.js");
      await handleSetupButton(interaction);
      return;
    }

    if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu()) {
      const { handleSetupSelect } = await import("../interactions/selects/setup.selects.js");
      await handleSetupSelect(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith("solicitation_medal_select:")) {
        const { handleSolicitationMedalSelect } = await import("../interactions/buttons/ticket.buttons.js");
        await handleSolicitationMedalSelect(interaction);
        return;
      }

      if (interaction.customId.startsWith("solicitation_proofs_select:")) {
        const { viewProofsForMedal } = await import("../services/solicitation.service.js");
        await viewProofsForMedal(interaction);
        return;
      }

      if (interaction.customId.startsWith("medal_category_select:")) {
        const { handleMedalCategorySelect } = await import("../commands/medal.js");
        await handleMedalCategorySelect(interaction);
        return;
      }

      if (interaction.customId.startsWith("medal_delivery_roles:")) {
        const { handleMedalDeliveryRoleSelect } = await import("../commands/medal.js");
        await handleMedalDeliveryRoleSelect(interaction);
        return;
      }

      if (interaction.customId.startsWith("medal_approval_roles:")) {
        const { handleMedalApprovalRoleSelect } = await import("../commands/medal.js");
        await handleMedalApprovalRoleSelect(interaction);
        return;
      }

      if (interaction.customId.startsWith("medal_delivery_permission_roles:")) {
        const { handleMedalDeliveryPermissionRoleSelect } = await import("../commands/medal.js");
        await handleMedalDeliveryPermissionRoleSelect(interaction);
        return;
      }

      if (interaction.customId.startsWith("ticket_medal_select:")) {
        const { handleTicketMedalSelect } = await import("../interactions/selects/ticket.selects.js");
        await handleTicketMedalSelect(interaction);
        return;
      }

      return;
    }

    if (interaction.isModalSubmit()) {
      console.log("📝 [INTERACTION] Modal recebido:", interaction.customId);

      if (interaction.customId.startsWith("solicitation_proofs_modal:")) {
        const { handleSolicitationProofModal } = await import("../interactions/buttons/ticket.buttons.js");
        await handleSolicitationProofModal(interaction);
        return;
      }

      if (interaction.customId.startsWith("solicitation_deny_modal:")) {
        const { handleDenialModal } = await import("../interactions/buttons/ticket.buttons.js");
        await handleDenialModal(interaction);
        return;
      }

      if (interaction.customId.startsWith("ticket_medal_deny_modal:")) {
        const { handleTicketMedalDenyModal } = await import("../interactions/modals/ticket.modals.js");
        await handleTicketMedalDenyModal(interaction);
        return;
      }

      if (interaction.customId.startsWith("ticket_roblox_modal:")) {
        const { handleTicketRobloxModal } = await import("../interactions/modals/ticket.modals.js");
        await handleTicketRobloxModal(interaction);
        return;
      }

      if (interaction.customId === "medal_create") {
        const { handleMedalModal } = await import("../commands/medal.js");
        await handleMedalModal(interaction);
        return;
      }

      if (interaction.customId === "category_create") {
        const { handleCategoryModal } = await import("../commands/category.js");
        await handleCategoryModal(interaction);
        return;
      }

      if (interaction.customId === "setup_delivery_guild_modal") {
        const { handleSetupDeliveryGuildModal } = await import("../interactions/buttons/setup.buttons.js");
        await handleSetupDeliveryGuildModal(interaction);
        return;
      }

      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) return;
    await command.execute(interaction);
  } catch (error) {
    console.error("❌ [INTERACTION] Erro ao processar interação:", error);
    if (!interaction.isRepliable()) return;

    try {
      const errorMessage = [
        "## ❌ Algo deu errado",
        "",
        "O Atlas não conseguiu concluir esta ação.",
        "",
        "-# Tente novamente em alguns instantes.",
        "-# Se o problema persistir, informe um administrador.",
      ].join("\n");

      if (interaction.replied || interaction.deferred) await interaction.followUp({ content: errorMessage, flags: 64 });
      else await interaction.reply({ content: errorMessage, flags: 64 });
    } catch (replyError) {
      console.error("❌ [INTERACTION] Não foi possível enviar a mensagem de erro:", replyError);
    }
  }
});

await connectDatabase();
await loadCommands();
console.log("🪖 Atlas está inicializando...");
await client.login(env.discordToken);
