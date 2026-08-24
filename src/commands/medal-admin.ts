import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

import { prisma } from "../infrastructure/database/prisma.js";
import { logAuditEvent } from "../services/audit-log.service.js";
import { updateMedalCatalog } from "../services/medal-catalog.service.js";
import { Command } from "../types/command.js";

// ==========================================================
// COMANDO
// ==========================================================

export const data = new SlashCommandBuilder()
  .setName("medal-admin")
  .setDescription("Administra medalhas cadastradas no Atlas.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("editar")
      .setDescription("Edita uma medalha existente.")
      .addStringOption((option) =>
        option
          .setName("medalha")
          .setDescription("ID ou nome atual da medalha.")
          .setRequired(true)
          .setMaxLength(100)
      )
      .addStringOption((option) =>
        option
          .setName("nome")
          .setDescription("Novo nome da medalha.")
          .setRequired(false)
          .setMaxLength(100)
      )
      .addStringOption((option) =>
        option
          .setName("requisitos")
          .setDescription("Novos requisitos da medalha.")
          .setRequired(false)
          .setMaxLength(6000)
      )
      .addStringOption((option) =>
        option
          .setName("jurisprudencia")
          .setDescription("Nova jurisprudência. Use 'none' para remover.")
          .setRequired(false)
          .setMaxLength(6000)
      )
      .addStringOption((option) =>
        option
          .setName("emoji")
          .setDescription("Novo emoji. Use 'none' para remover.")
          .setRequired(false)
          .setMaxLength(20)
      )
      .addStringOption((option) =>
        option
          .setName("cor")
          .setDescription("Nova cor hexadecimal. Use 'none' para remover.")
          .setRequired(false)
          .setMaxLength(7)
      )
      .addStringOption((option) =>
        option
          .setName("categoria")
          .setDescription("ID ou nome da nova categoria.")
          .setRequired(false)
          .setMaxLength(100)
      )
      .addStringOption((option) =>
        option
          .setName("cargos_entrega")
          .setDescription("IDs dos cargos concedidos, separados por vírgula. Não informado = mantém.")
          .setRequired(false)
          .setMaxLength(1000)
      )
      .addStringOption((option) =>
        option
          .setName("cargos_aprovacao")
          .setDescription("IDs dos cargos de aprovação, separados por vírgula. Não informado = mantém.")
          .setRequired(false)
          .setMaxLength(1000)
      )
      .addStringOption((option) =>
        option
          .setName("cargos_entrega_permissao")
          .setDescription("IDs dos cargos autorizados a entregar, separados por vírgula. Não informado = mantém.")
          .setRequired(false)
          .setMaxLength(1000)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("excluir")
      .setDescription("Desativa uma medalha e remove sua publicação do catálogo.")
      .addStringOption((option) =>
        option
          .setName("medalha")
          .setDescription("ID ou nome da medalha.")
          .setRequired(true)
          .setMaxLength(100)
      )
  );

// ==========================================================
// HELPERS
// ==========================================================

function splitRoleIds(value: string): string[] {
  return [...new Set(
    value
      .split(",")
      .map((roleId) => roleId.trim())
      .filter(Boolean)
  )];
}

async function findMedal(identifier: string) {
  const byId = await prisma.medal.findUnique({
    where: { id: identifier },
    include: {
      category: true,
      deliveryRoles: true,
      approvalRoles: true,
      deliveryPermissionRoles: true,
    },
  });

  if (byId) return byId;

  return prisma.medal.findFirst({
    where: {
      name: {
        equals: identifier,
        mode: "insensitive",
      },
    },
    include: {
      category: true,
      deliveryRoles: true,
      approvalRoles: true,
      deliveryPermissionRoles: true,
    },
  });
}

async function validateRoles(
  interaction: ChatInputCommandInteraction,
  roleIds: string[],
  label: string
): Promise<boolean> {
  const roles = await interaction.guild!.roles.fetch();

  const invalid = roleIds.filter((roleId) => {
    const role = roles.get(roleId);
    return !role || role.managed || role.id === interaction.guild!.id;
  });

  if (invalid.length > 0) {
    await interaction.reply({
      content: [
        "## ❌ Cargo inválido",
        "",
        `Um ou mais cargos informados em **${label}** não existem neste servidor ou são cargos gerenciados.`,
        "",
        `-# IDs inválidos: ${invalid.map((id) => `\`${id}\``).join(", ")}`,
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return false;
  }

  return true;
}

// ==========================================================
// EXECUTE
// ==========================================================

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
      content: "❌ Apenas administradores podem gerenciar medalhas.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const identifier = interaction.options.getString("medalha", true);
  const medal = await findMedal(identifier);

  if (!medal) {
    await interaction.reply({
      content: [
        "## ❌ Medalha não encontrada",
        "",
        `Não foi encontrada nenhuma medalha correspondente a **${identifier}**.`,
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // ========================================================
  // EXCLUIR
  // ========================================================

  if (subcommand === "excluir") {
    if (!medal.active) {
      await interaction.reply({
        content: "⚠️ Esta medalha já está desativada.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await prisma.medal.update({
      where: { id: medal.id },
      data: { active: false },
    });

    await logAuditEvent({
      guild: interaction.guild,
      action: "MEDAL_REMOVED",
      executorId: interaction.user.id,
      medalId: medal.id,
      details: {
        name: medal.name,
        categoryId: medal.category.id,
        categoryName: medal.category.name,
        reason: "Medalha desativada pelo administrador.",
      },
    });

    await updateMedalCatalog(interaction.guild);

    await interaction.reply({
      content: [
        "## 🗑️ Medalha removida",
        "",
        `🎖️ **${medal.name}** foi desativada com sucesso.`,
        `🗂️ **Categoria:** ${medal.category.name}`,
        "",
        "A medalha foi retirada do catálogo, mas seus registros históricos continuam preservados.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ========================================================
  // EDITAR
  // ========================================================

  const name = interaction.options.getString("nome");
  const requirements = interaction.options.getString("requisitos");
  const jurisprudence = interaction.options.getString("jurisprudencia");
  const emoji = interaction.options.getString("emoji");
  const color = interaction.options.getString("cor");
  const categoryIdentifier = interaction.options.getString("categoria");
  const deliveryRolesValue = interaction.options.getString("cargos_entrega");
  const approvalRolesValue = interaction.options.getString("cargos_aprovacao");
  const deliveryPermissionRolesValue = interaction.options.getString("cargos_entrega_permissao");

  if (
    name === null &&
    requirements === null &&
    jurisprudence === null &&
    emoji === null &&
    color === null &&
    categoryIdentifier === null &&
    deliveryRolesValue === null &&
    approvalRolesValue === null &&
    deliveryPermissionRolesValue === null
  ) {
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

  if (requirements !== null && !requirements.trim()) {
    await interaction.reply({
      content: "❌ Os requisitos não podem ficar vazios.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (color !== null && color.toLowerCase() !== "none" && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    await interaction.reply({
      content: "❌ A cor é inválida. Use o formato `#5865F2` ou `none` para remover.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let category = medal.category;

  if (categoryIdentifier !== null) {
    category =
      (await prisma.medalCategory.findUnique({
        where: { id: categoryIdentifier },
      })) ??
      (await prisma.medalCategory.findFirst({
        where: {
          name: {
            equals: categoryIdentifier,
            mode: "insensitive",
          },
        },
      })) as typeof category | null;

    if (!category || !category.active) {
      await interaction.reply({
        content: "❌ A nova categoria não foi encontrada ou está desativada.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const deliveryRoleIds = deliveryRolesValue !== null ? splitRoleIds(deliveryRolesValue) : null;
  const approvalRoleIds = approvalRolesValue !== null ? splitRoleIds(approvalRolesValue) : null;
  const deliveryPermissionRoleIds = deliveryPermissionRolesValue !== null ? splitRoleIds(deliveryPermissionRolesValue) : null;

  if (deliveryRoleIds && !(await validateRoles(interaction, deliveryRoleIds, "cargos_entrega"))) return;
  if (approvalRoleIds && !(await validateRoles(interaction, approvalRoleIds, "cargos_aprovacao"))) return;
  if (deliveryPermissionRoleIds && !(await validateRoles(interaction, deliveryPermissionRoleIds, "cargos_entrega_permissao"))) return;

  const duplicate = name
    ? await prisma.medal.findFirst({
        where: {
          id: { not: medal.id },
          name: { equals: name.trim(), mode: "insensitive" },
          active: true,
        },
      })
    : null;

  if (duplicate) {
    await interaction.reply({
      content: "❌ Já existe outra medalha ativa com esse nome.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedMedal = await tx.medal.update({
      where: { id: medal.id },
      data: {
        name: name !== null ? name.trim() : undefined,
        requirements: requirements !== null ? requirements.trim() : undefined,
        jurisprudence:
          jurisprudence !== null
            ? jurisprudence.toLowerCase() === "none"
              ? null
              : jurisprudence.trim() || null
            : undefined,
        emoji:
          emoji !== null
            ? emoji.toLowerCase() === "none"
              ? null
              : emoji.trim() || null
            : undefined,
        color:
          color !== null
            ? color.toLowerCase() === "none"
              ? null
              : color.trim()
            : undefined,
        categoryId: category.id,
      },
    });

    if (deliveryRoleIds !== null) {
      await tx.medalRole.deleteMany({ where: { medalId: medal.id } });
      if (deliveryRoleIds.length > 0) {
        await tx.medalRole.createMany({
          data: deliveryRoleIds.map((roleId) => ({ medalId: medal.id, roleId })),
          skipDuplicates: true,
        });
      }
    }

    if (approvalRoleIds !== null) {
      await tx.medalApprovalRole.deleteMany({ where: { medalId: medal.id } });
      if (approvalRoleIds.length > 0) {
        await tx.medalApprovalRole.createMany({
          data: approvalRoleIds.map((roleId) => ({ medalId: medal.id, roleId })),
          skipDuplicates: true,
        });
      }
    }

    if (deliveryPermissionRoleIds !== null) {
      await tx.medalDeliveryPermissionRole.deleteMany({ where: { medalId: medal.id } });
      if (deliveryPermissionRoleIds.length > 0) {
        await tx.medalDeliveryPermissionRole.createMany({
          data: deliveryPermissionRoleIds.map((roleId) => ({ medalId: medal.id, roleId })),
          skipDuplicates: true,
        });
      }
    }

    return updatedMedal;
  });

  await logAuditEvent({
    guild: interaction.guild,
    action: "MEDAL_UPDATED",
    executorId: interaction.user.id,
    medalId: updated.id,
    details: {
      name: updated.name,
      categoryId: category.id,
      categoryName: category.name,
      changedFields: [
        name !== null ? "name" : null,
        requirements !== null ? "requirements" : null,
        jurisprudence !== null ? "jurisprudence" : null,
        emoji !== null ? "emoji" : null,
        color !== null ? "color" : null,
        categoryIdentifier !== null ? "category" : null,
        deliveryRolesValue !== null ? "deliveryRoles" : null,
        approvalRolesValue !== null ? "approvalRoles" : null,
        deliveryPermissionRolesValue !== null ? "deliveryPermissionRoles" : null,
      ].filter(Boolean),
    },
  });

  await updateMedalCatalog(interaction.guild);

  await interaction.reply({
    content: [
      "## ✏️ Medalha atualizada",
      "",
      `🎖️ **${updated.name}**`,
      `🗂️ **Categoria:** ${category.name}`,
      "",
      "As alterações foram salvas e o catálogo foi sincronizado automaticamente.",
      "",
      "-# O histórico da medalha continua preservado.",
    ].join("\n"),
    flags: MessageFlags.Ephemeral,
  });
}
