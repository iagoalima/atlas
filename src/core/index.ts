import { client } from "./discord/client.js";
import { env } from "../config/env.js";
import { commands, loadCommands } from "./discord/commands.js";
import { connectDatabase } from "./database.js";
import { installInteractionMessageStyle } from "../ui/interaction-messages.js";
import { handleRequestButton, handleRequestMessage, handleRequestModal, handleRequestSelect, handleProofView } from "../services/request-flow.service.js";

client.once("clientReady", (bot) => console.log(`Atlas conectado como ${bot.user.tag}`));

client.on("messageCreate", async (message) => {
  try {
    if (await handleRequestMessage(message)) return;
    if (message.guild) {
      const { handleTicketMessage } = await import("../interactions/messages/ticket.messages.js");
      await handleTicketMessage(message);
    }
  } catch (error) {
    console.error("❌ [MESSAGE] Erro ao processar mensagem:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    installInteractionMessageStyle(interaction);

    if (interaction.isButton()) {
      if (await handleRequestButton(interaction)) return;
      if (await handleProofView(interaction)) return;
      if (interaction.customId.startsWith("ticket_")) {
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
      if (await handleRequestSelect(interaction)) return;
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
      return;
    }

    if (interaction.isModalSubmit()) {
      if (await handleRequestModal(interaction)) return;
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
    if (command) await command.execute(interaction);
  } catch (error) {
    console.error("❌ [INTERACTION] Erro ao processar interação:", error);
    if (!interaction.isRepliable()) return;
    try {
      const content = "## ❌ Algo deu errado\n\nO Atlas não conseguiu concluir esta ação.\n\n-# Tente novamente em alguns instantes.";
      if (interaction.replied || interaction.deferred) await interaction.followUp({ content, flags: 64 });
      else await interaction.reply({ content, flags: 64 });
    } catch (replyError) {
      console.error("❌ [INTERACTION] Não foi possível responder ao erro:", replyError);
    }
  }
});

await connectDatabase();
await loadCommands();
console.log("🪖 Atlas está inicializando...");
await client.login(env.discordToken);
