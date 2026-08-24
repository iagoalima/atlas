import { client } from "./discord/client.js";

import { env } from "../config/env.js";

import {
  commands,
  loadCommands,
} from "./discord/commands.js";

import { connectDatabase } from "./database.js";
import { installInteractionMessageStyle } from "../ui/interaction-messages.js";

// ==========================================================
// ATLAS ONLINE
// ==========================================================

client.once("clientReady", (bot) => {
  console.log(
    `Atlas conectado como ${bot.user.tag}`
  );
});

// ==========================================================
// MENSAGENS
// ==========================================================

client.on(
  "messageCreate",
  async (message) => {
    try {
      // ======================================================
      // MENSAGENS DE TICKET
      // ======================================================

      const {
        handleTicketMessage,
      } = await import(
        "../interactions/messages/ticket.messages.js"
      );

      await handleTicketMessage(
        message
      );
    } catch (error) {
      console.error(
        "❌ [MESSAGE] Erro ao processar mensagem:",
        error
      );
    }
  }
);

// ==========================================================
// INTERAÇÕES
// ==========================================================

client.on(
  "interactionCreate",
  async (interaction) => {
    console.log(
      "🔔 [INTERACTION] Recebida:",
      {
        type: interaction.type,
        customId:
          "customId" in interaction
            ? interaction.customId
            : undefined,
        componentType:
          "componentType" in interaction
            ? interaction.componentType
            : undefined,
        isButton:
          interaction.isButton(),
        isRoleSelect:
          interaction.isRoleSelectMenu(),
        isStringSelect:
          interaction.isStringSelectMenu(),
        isChannelSelect:
          interaction.isChannelSelectMenu(),
        isModal:
          interaction.isModalSubmit(),
        isChatInput:
          interaction.isChatInputCommand(),
      }
    );

    try {
      // ======================================================
      // PADRÃO VISUAL DO ATLAS
      // ======================================================
      //
      // Todas as respostas textuais de interações passam por
      // uma camada central que converte respostas legadas para
      // Components V2. Respostas que já utilizam Components V2
      // permanecem intactas.
      //
      installInteractionMessageStyle(interaction);

      // ======================================================
      // BOTÕES
      // ======================================================

      if (interaction.isButton()) {
        console.log(
          "🔘 [INTERACTION] Botão recebido:",
          interaction.customId
        );

        // ====================================================
        // BOTÕES DE TICKET
        // ====================================================

        if (
          interaction.customId.startsWith(
            "ticket_"
          )
        ) {
          console.log(
            "🎫 [INTERACTION] Botão de ticket identificado."
          );

          const {
            handleTicketButton,
          } = await import(
            "../interactions/buttons/ticket.buttons.js"
          );

          await handleTicketButton(
            interaction
          );

          console.log(
            "✅ [INTERACTION] Botão de ticket processado."
          );

          return;
        }

        // ====================================================
        // BOTÕES DO SETUP
        // ====================================================

        const {
          handleSetupButton,
        } = await import(
          "../interactions/buttons/setup.buttons.js"
        );

        await handleSetupButton(
          interaction
        );

        console.log(
          "✅ [INTERACTION] Botão de setup processado."
        );

        return;
      }

      // ======================================================
      // SELECTS DE ROLE / CHANNEL
      // ======================================================

      if (
        interaction.isRoleSelectMenu() ||
        interaction.isChannelSelectMenu()
      ) {
        console.log(
          "🔽 [INTERACTION] Select de configuração recebido:",
          interaction.customId
        );

        const {
          handleSetupSelect,
        } = await import(
          "../interactions/selects/setup.selects.js"
        );

        await handleSetupSelect(
          interaction
        );

        console.log(
          "✅ [INTERACTION] Select de configuração processado."
        );

        return;
      }

      // ======================================================
      // SELECTS DE TEXTO
      // ======================================================

      if (interaction.isStringSelectMenu()) {
        console.log(
          "🎖️ [INTERACTION] String Select recebido:",
          interaction.customId
        );

        if (
          interaction.customId.startsWith(
            "medal_category_select:"
          )
        ) {
          const {
            handleMedalCategorySelect,
          } = await import(
            "../commands/medal.js"
          );

          await handleMedalCategorySelect(
            interaction
          );

          return;
        }

        if (
          interaction.customId.startsWith(
            "medal_delivery_roles:"
          )
        ) {
          console.log(
            "🛡️ [INTERACTION] Select de cargos da medalha identificado."
          );

          const {
            handleMedalDeliveryRoleSelect,
          } = await import(
            "../commands/medal.js"
          );

          await handleMedalDeliveryRoleSelect(
            interaction
          );

          console.log(
            "✅ [INTERACTION] Select de cargos da medalha processado."
          );

          return;
        }

        if (
          interaction.customId.startsWith(
            "medal_approval_roles:"
          )
        ) {
          console.log(
            "⚖️ [INTERACTION] Select de cargos de aprovação identificado."
          );

          const {
            handleMedalApprovalRoleSelect,
          } = await import(
            "../commands/medal.js"
          );

          await handleMedalApprovalRoleSelect(
            interaction
          );

          console.log(
            "✅ [INTERACTION] Select de cargos de aprovação processado."
          );

          return;
        }

        if (
          interaction.customId.startsWith(
            "medal_delivery_permission_roles:"
          )
        ) {
          console.log(
            "🪖 [INTERACTION] Select de cargos autorizados a entregar identificado."
          );

          const {
            handleMedalDeliveryPermissionRoleSelect,
          } = await import(
            "../commands/medal.js"
          );

          await handleMedalDeliveryPermissionRoleSelect(
            interaction
          );

          console.log(
            "✅ [INTERACTION] Select de cargos autorizados a entregar processado."
          );

          return;
        }

        if (
          interaction.customId.startsWith(
            "ticket_medal_select:"
          )
        ) {
          const {
            handleTicketMedalSelect,
          } = await import(
            "../interactions/selects/ticket.selects.js"
          );

          await handleTicketMedalSelect(
            interaction
          );

          return;
        }

        console.log(
          "⚠️ [INTERACTION] String Select não reconhecido."
        );

        return;
      }

      // ======================================================
      // MODAIS
      // ======================================================

      if (interaction.isModalSubmit()) {
        console.log(
          "📝 [INTERACTION] Modal recebido:",
          interaction.customId
        );

        if (
          interaction.customId.startsWith(
            "ticket_roblox_modal:"
          )
        ) {
          console.log(
            "🎮 [INTERACTION] Modal de identificação Roblox recebido."
          );

          const {
            handleTicketRobloxModal,
          } = await import(
            "../interactions/modals/ticket.modals.js"
          );

          await handleTicketRobloxModal(
            interaction
          );

          console.log(
            "🎮 [INTERACTION] handleTicketRobloxModal concluído."
          );

          return;
        }

        if (
          interaction.customId ===
          "medal_create"
        ) {
          console.log(
            "🎖️ [INTERACTION] Modal de criação de medalha identificado."
          );

          const {
            handleMedalModal,
          } = await import(
            "../commands/medal.js"
          );

          await handleMedalModal(
            interaction
          );

          console.log(
            "🎖️ [INTERACTION] handleMedalModal concluído."
          );

          return;
        }

        if (
          interaction.customId ===
          "category_create"
        ) {
          console.log(
            "🗂️ [INTERACTION] Modal de criação de categoria identificado."
          );

          const {
            handleCategoryModal,
          } = await import(
            "../commands/category.js"
          );

          await handleCategoryModal(
            interaction
          );

          console.log(
            "🗂️ [INTERACTION] handleCategoryModal concluído."
          );

          return;
        }

        if (
          interaction.customId ===
          "setup_delivery_guild_modal"
        ) {
          console.log(
            "🏰 [INTERACTION] Modal de servidor de entrega identificado."
          );

          const {
            handleSetupDeliveryGuildModal,
          } = await import(
            "../interactions/buttons/setup.buttons.js"
          );

          await handleSetupDeliveryGuildModal(
            interaction
          );

          console.log(
            "🏰 [INTERACTION] handleSetupDeliveryGuildModal concluído."
          );

          return;
        }

        console.log(
          "📝 [INTERACTION] Modal não reconhecido."
        );

        return;
      }

      // ======================================================
      // SLASH COMMANDS
      // ======================================================

      if (
        !interaction.isChatInputCommand()
      ) {
        return;
      }

      console.log(
        `⚡ [COMMAND] Comando recebido: /${interaction.commandName}`
      );

      const command =
        commands.get(
          interaction.commandName
        );

      if (!command) {
        console.warn(
          `⚠️ [COMMAND] Comando não encontrado: /${interaction.commandName}`
        );

        return;
      }

      console.log(
        `🟢 [COMMAND] Executando /${interaction.commandName}`
      );

      await command.execute(
        interaction
      );

      console.log(
        `🟢 [COMMAND] /${interaction.commandName} executado com sucesso.`
      );
    } catch (error) {
      console.error(
        "❌ [INTERACTION] Erro ao processar interação:",
        error
      );

      if (
        !interaction.isRepliable()
      ) {
        console.warn(
          "⚠️ [INTERACTION] Interação não pode mais receber resposta."
        );

        return;
      }

      try {
        const errorMessage = [
          "## ❌ Algo deu errado",
          "",
          "O Atlas não conseguiu concluir esta ação.",
          "",
          "-# Tente novamente em alguns instantes.",
          "-# Se o problema persistir, informe um administrador.",
        ].join("\n");

        if (
          interaction.replied ||
          interaction.deferred
        ) {
          await interaction.followUp({
            content: errorMessage,
            flags: 64,
          });
        } else {
          await interaction.reply({
            content: errorMessage,
            flags: 64,
          });
        }
      } catch (replyError) {
        console.error(
          "❌ [INTERACTION] Não foi possível enviar a mensagem de erro:",
          replyError
        );
      }
    }
  }
);

// ==========================================================
// INICIALIZAÇÃO
// ==========================================================

await connectDatabase();

await loadCommands();

console.log(
  "🪖 Atlas está inicializando..."
);

await client.login(
  env.discordToken
);