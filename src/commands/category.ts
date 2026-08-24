import {
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

import {
  logAuditEvent,
} from "../services/audit-log.service.js";

import { updateMedalCatalog } from "../services/medal-catalog.service.js";

import { prisma } from "../infrastructure/database/prisma.js";
import { Command } from "../types/command.js";

export const data = new SlashCommandBuilder()
  .setName("categoria")
  .setDescription("Gerencia as categorias de medalhas.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("criar")
      .setDescription("Cria uma nova categoria de medalhas.")
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ Este comando só pode ser usado em um servidor.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const member = await interaction.guild.members.fetch(
    interaction.user.id
  );

  if (!member.permissions.has("Administrator")) {
    await interaction.reply({
      content: "❌ Apenas administradores podem gerenciar categorias.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const modal = new ModalBuilder()
    .setCustomId("category_create")
    .setTitle("🗂️ Nova categoria");

  const nameInput = new TextInputBuilder()
    .setCustomId("category_name")
    .setLabel("Nome")
    .setPlaceholder("Ex.: Medalhas Anuais")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const descriptionInput = new TextInputBuilder()
    .setCustomId("category_description")
    .setLabel("Descrição")
    .setPlaceholder("Explique brevemente esta categoria.")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000);

  const emojiInput = new TextInputBuilder()
    .setCustomId("category_emoji")
    .setLabel("Emoji")
    .setPlaceholder("Ex.: 🏆")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(20);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      descriptionInput
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(emojiInput)
  );

  await interaction.showModal(modal);
}

export async function handleCategoryModal(
  interaction: import("discord.js").ModalSubmitInteraction
): Promise<void> {
  if (interaction.customId !== "category_create") {
    return;
  }

  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ Este formulário só pode ser utilizado em um servidor.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const member = await interaction.guild.members.fetch(
    interaction.user.id
  );

  if (!member.permissions.has("Administrator")) {
    await interaction.reply({
      content: "❌ Apenas administradores podem criar categorias.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const name = interaction.fields
    .getTextInputValue("category_name")
    .trim();

  const description =
    interaction.fields
      .getTextInputValue("category_description")
      .trim() || null;

  const emoji =
    interaction.fields
      .getTextInputValue("category_emoji")
      .trim() || null;

  const existingCategory = await prisma.medalCategory.findUnique({
    where: {
      name,
    },
  });

  if (existingCategory) {
    await interaction.reply({
      content: "❌ Já existe uma categoria com esse nome.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const lastCategory = await prisma.medalCategory.findFirst({
    orderBy: {
      position: "desc",
    },
  });

  const position = lastCategory
    ? lastCategory.position + 1
    : 0;

  const category = await prisma.medalCategory.create({
    data: {
      name,
      description,
      emoji,
      position,
    },
  });

  await logAuditEvent({
    guild: interaction.guild,
    action: "CATEGORY_CREATED",
    executorId: interaction.user.id,
    details: {
      categoryId: category.id,
      name: category.name,
      description: category.description,
      emoji: category.emoji,
      position: category.position,
    },
  });

  // ========================================================
  // SINCRONIZA O CATÁLOGO
  // ========================================================

  let catalogSynced = false;

  try {
    catalogSynced = await updateMedalCatalog(interaction.guild);
  } catch (error) {
    console.warn(
      "⚠️ [CATEGORY] Categoria criada, mas não foi possível sincronizar o catálogo:",
      error
    );
  }

  await interaction.reply({
    content: [
      "## 🗂️ Categoria criada com sucesso",
      "",
      `📁 **${category.name}**`,
      `🔢 **Posição:** ${category.position}`,
      category.description
        ? `📝 **Descrição:** ${category.description}`
        : null,
      category.emoji
        ? `✨ **Emoji:** ${category.emoji}`
        : null,
      "",
      catalogSynced
        ? "✅ O catálogo também foi sincronizado automaticamente."
        : "⚠️ A categoria foi salva, mas o catálogo não pôde ser sincronizado. Verifique a configuração do catálogo.",
    ]
      .filter(Boolean)
      .join("\n"),
    flags: MessageFlags.Ephemeral,
  });
}