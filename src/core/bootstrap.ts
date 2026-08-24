import { client } from "./discord/client.js";
import { env } from "../config/env.js";
import {
  commands,
  loadCommands,
} from "./discord/commands.js";
import { connectDatabase } from "./database.js";

client.once("clientReady", (bot) => {
  console.log(`Atlas conectado como ${bot.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  try {
    // ======================================================
    // BOTÕES
    // ======================================================

    if (interaction.isButton()) {
      const { handleSetupButton } = await import(
        "../interactions/buttons/setup.buttons.js"
      );

      await handleSetupButton(interaction);

      return;
    }

    // ======================================================
    // SELECTS DO SETUP
    // ======================================================

    if (
      interaction.isRoleSelectMenu() ||
      interaction.isChannelSelectMenu()
    ) {
      const { handleSetupSelect } = await import(
        "../interactions/selects/setup.selects.js"
      );

      await handleSetupSelect(interaction);

      return;
    }

    // ======================================================
    // SELECT DE CATEGORIA DA MEDALHA
    // ======================================================

    if (interaction.isStringSelectMenu()) {
      if (
        interaction.customId.startsWith(
          "medal_category_select:"
        )
      ) {
        const { handleMedalCategorySelect } =
          await import("../commands/medal.js");

        await handleMedalCategorySelect(interaction);

        return;
      }

      return;
    }

    // ======================================================
    // MODAIS
    // ======================================================

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "medal_create") {
        const { handleMedalModal } = await import(
          "../commands/medal.js"
        );

        await handleMedalModal(interaction);

        return;
      }

      if (interaction.customId === "category_create") {
        const { handleCategoryModal } = await import(
          "../commands/category.js"
        );

        await handleCategoryModal(interaction);

        return;
      }

      return;
    }

    // ======================================================
    // SLASH COMMANDS
    // ======================================================

    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = commands.get(
      interaction.commandName
    );

    if (!command) {
      console.warn(
        `Comando não encontrado: ${interaction.commandName}`
      );

      return;
    }

    await command.execute(interaction);
  } catch (error) {
    console.error(
      "Erro ao processar interação:",
      error
    );

    // ======================================================
    // TRATAMENTO SE A INTERAÇÃO AINDA ESTIVER DISPONÍVEL
    // ======================================================

    if (
      interaction.isChatInputCommand() ||
      interaction.isButton() ||
      interaction.isStringSelectMenu() ||
      interaction.isRoleSelectMenu() ||
      interaction.isChannelSelectMenu() ||
      interaction.isModalSubmit()
    ) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content:
            "❌ Ocorreu um erro ao processar esta interação.",
          flags: 64,
        });
      } else {
        await interaction.reply({
          content:
            "❌ Ocorreu um erro ao processar esta interação.",
          flags: 64,
        });
      }
    }
  }
});

// ==========================================================
// INICIALIZAÇÃO
// ==========================================================

await connectDatabase();
await loadCommands();

console.log("🪖 Atlas está inicializando...");

await client.login(env.discordToken);