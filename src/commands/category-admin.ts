import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

import { prisma } from "../infrastructure/database/prisma.js";
import { logAuditEvent } from "../services/audit-log.service.js";
import { updateMedalCatalog } from "../services/medal-catalog.service.js";
import { Command } from "../types/command.js";

export const data = new SlashCommandBuilder()
  .setName("categoria-admin")
  .setDescription("Administra categorias de medalhas do Atlas.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("editar")
      .setDescription("Edita uma categoria existente.")
      .addStringOption((option) =>
        option
          .setName("categoria")
          .setDescription("ID ou nome atual da categoria.")
          .setRequired(true)
          .setMaxLength(100)
      )
      .addStringOption((option) =>
        option
          .setName("nome")
          .setDescription("Novo nome da categoria.")
          .setRequired(false)
          .setMaxLength(100)
      )
      .addStringOption((option) =>
        option
          .setName("descricao")
          .setDescription("Nova descrição. Use 'none' para remover.")
          .setRequired(false)
          .setMaxLength(1000)
      )
      .addStringOption((option) =>
        option
          .setName("emoji")
          .setDescription("Novo emoji. Use 'none' para remover.")
          .setRequired(false)
          .setMaxLength(20)
      )
      .addIntegerOption((option) =>
        option
          .setName("posicao")
          .setDescription("Nova posição no catálogo.")
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(10000)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("excluir")
      .setDescription("Desativa uma categoria e remove sua publicação do catálogo.")
      .addStringOption((option) =>
        option
          .setName("categoria")
          .setDescription("ID ou nome da categoria.")
          .setRequired(true)
          .setMaxLength(100)
      )
  );

async function findCategory(identifier: string) {
  const byId = await prisma.medalCategory.findUnique({
    where: { id: identifier },
  });

  if (byId) return byId;

  return prisma.medalCategory.findFirst({
    where: {
      name: {
        equals: identifier,
        mode: "insensitive",
      },
    },
  });
}

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

  const member = await interaction.guild.members.fetch(interaction.user.id);

  if (!member.permissions.has("Administrator")) {
    await interaction.reply({
      content: "❌ Apenas administradores podem gerenciar categorias.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const identifier = interaction.options.getString("categoria", true);
  const category = await findCategory(identifier);

  if (!category) {
    await interaction.reply({
      content: `❌ Não foi encontrada nenhuma categoria correspondente a **${identifier}**.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "excluir") {
    if (!category.active) {
      await interaction.reply({
        content: "⚠️ Esta categoria já está desativada.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await prisma.medalCategory.update({
      where: { id: category.id },
      data: { active: false },
    });

    await logAuditEvent({
      guild: interaction.guild,
      action: "CATEGORY_REMOVED",
      executorId: interaction.user.id,
      details: {
        categoryId: category.id,
        name: category.name,
        description: category.description,
        emoji: category.emoji,
        position: category.position,
        reason: "Categoria desativada pelo administrador.",
      },
    });

    await updateMedalCatalog(interaction.guild);

    await interaction.reply({
      content: [
        "## 🗑️ Categoria removida",
        "",
        `🗂️ **${category.name}** foi desativada com sucesso.`,
        "",
        "As medalhas e registros históricos permanecem no banco, mas a categoria e suas medalhas ativas deixam de aparecer no catálogo.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const name = interaction.options.getString("nome");
  const description = interaction.options.getString("descricao");
  const emoji = interaction.options.getString("emoji");
  const position = interaction.options.getInteger("posicao");

  if (name === null && description === null && emoji === null && position === null) {
    await interaction.reply({
      content: "⚠️ Informe pelo menos um campo para alterar.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (name !== null && !name.trim()) {
    await interaction.reply({
      content: "❌ O novo nome não pode ficar vazio.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const duplicate = name
    ? await prisma.medalCategory.findFirst({
        where: {
          id: { not: category.id },
          name: { equals: name.trim(), mode: "insensitive" },
        },
      })
    : null;

  if (duplicate) {
    await interaction.reply({
      content: "❌ Já existe uma categoria com esse nome.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const updated = await prisma.medalCategory.update({
    where: { id: category.id },
    data: {
      name: name !== null ? name.trim() : undefined,
      description:
        description !== null
          ? description.toLowerCase() === "none"
            ? null
            : description.trim() || null
          : undefined,
      emoji:
        emoji !== null
          ? emoji.toLowerCase() === "none"
            ? null
            : emoji.trim() || null
          : undefined,
      position: position !== null ? position : undefined,
    },
  });

  await logAuditEvent({
    guild: interaction.guild,
    action: "CATEGORY_UPDATED",
    executorId: interaction.user.id,
    details: {
      categoryId: updated.id,
      name: updated.name,
      changedFields: [
        name !== null ? "name" : null,
        description !== null ? "description" : null,
        emoji !== null ? "emoji" : null,
        position !== null ? "position" : null,
      ].filter(Boolean),
    },
  });

  await updateMedalCatalog(interaction.guild);

  await interaction.reply({
    content: [
      "## ✏️ Categoria atualizada",
      "",
      `🗂️ **${updated.name}**`,
      "",
      "As alterações foram salvas e o catálogo foi sincronizado automaticamente.",
    ].join("\n"),
    flags: MessageFlags.Ephemeral,
  });
}
