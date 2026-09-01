import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ContainerBuilder, MessageFlags, ModalBuilder, ModalSubmitInteraction, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { prisma } from "../infrastructure/database/prisma.js";
import { logAuditEvent } from "./audit-log.service.js";
import { deliverMedal } from "./medal-delivery.service.js";

export async function handleSeasonalReviewButton(interaction: ButtonInteraction): Promise<boolean> {
  const match = interaction.customId.match(/^ticket_medal_(approve|deny|deliver):(.+)$/);
  if (!match || !interaction.guild) return false;
  const action = match[1];
  const ticketMedalId = match[2];
  const tm = await prisma.ticketMedal.findUnique({ where: { id: ticketMedalId }, include: { ticket: true, medal: { include: { approvalRoles: true, deliveryPermissionRoles: true, category: true } } } });
  if (!tm || tm.ticket.requestGuildId !== interaction.guild.id || tm.ticket.channelId !== interaction.channelId) {
    await interaction.reply({ content: "❌ Esta solicitação não pertence a este canal de análise.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const member = await interaction.guild.members.fetch(interaction.user.id);

  if (action === "approve" || action === "deny") {
    if (!member.roles.cache.has(tm.ticket.requestGuildId ? (await prisma.guildConfig.findUnique({ where: { requestGuildId: interaction.guild.id }, select: { staffRoleId: true } }))?.staffRoleId ?? "" : "")) {
      await interaction.reply({ content: "## 🔒 Acesso restrito\n\nApenas a equipe de medalhas pode analisar solicitações.", flags: MessageFlags.Ephemeral });
      return true;
    }
    if (!tm.medal.approvalRoles.some((r) => member.roles.cache.has(r.roleId))) {
      await interaction.reply({ content: "## 🔒 Permissão insuficiente\n\nVocê não possui autorização para aprovar ou negar esta medalha.", flags: MessageFlags.Ephemeral });
      return true;
    }
    if (tm.status !== "PENDING") { await interaction.reply({ content: "⚠️ Esta medalha já foi analisada.", flags: MessageFlags.Ephemeral }); return true; }
    if (action === "deny") {
      const modal = new ModalBuilder().setCustomId(`request_deny:${tm.id}`).setTitle("Negar solicitação");
      const reason = new TextInputBuilder().setCustomId("reason").setLabel("Justificativa").setPlaceholder("Explique o motivo da negativa").setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(3).setMaxLength(1000);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reason));
      await interaction.showModal(modal);
      return true;
    }
    const updated = await prisma.ticketMedal.update({ where: { id: tm.id }, data: { status: "APPROVED", decidedBy: interaction.user.id, reason: null }, include: { medal: true, ticket: true } });
    await logAuditEvent({ guild: interaction.guild, action: "MEDAL_APPROVED", executorId: interaction.user.id, targetId: updated.ticket.userId, ticketId: updated.ticketId, medalId: updated.medalId, details: { ticketMedalId: updated.id, medalName: updated.medal.name, status: "APPROVED" } });
    await interaction.reply({ content: "## 🟢 Medalha aprovada\n\nA decisão foi registrada e o solicitante será notificado.", flags: MessageFlags.Ephemeral });
    return true;
  }

  if (tm.status !== "APPROVED") { await interaction.reply({ content: "## ⚠️ Entrega indisponível\n\nEsta medalha precisa estar aprovada antes da entrega.", flags: MessageFlags.Ephemeral }); return true; }
  if (!tm.medal.deliveryPermissionRoles.some((r) => member.roles.cache.has(r.roleId))) { await interaction.reply({ content: "## 🔒 Permissão insuficiente\n\nVocê não possui autorização para entregar esta medalha.", flags: MessageFlags.Ephemeral }); return true; }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const result = await deliverMedal({ client: interaction.client, ticketMedalId: tm.id, executorId: interaction.user.id, requestGuildId: interaction.guild.id });
    await interaction.editReply({ content: `## 🏅 Medalha entregue\n\n**${tm.medal.name}** foi entregue com sucesso.\n\n${result.addedRoleNames.length ? `Cargos concedidos: ${result.addedRoleNames.join(", ")}` : "O usuário já possuía os cargos necessários."}` });
  } catch (error) {
    console.error("❌ [SEASONAL REVIEW] Erro na entrega:", error);
    await interaction.editReply({ content: "## ❌ Não foi possível entregar a medalha\n\nA entrega não foi concluída." });
  }
  return true;
}

export async function handleSeasonalReviewModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith("request_deny:") || !interaction.guild) return false;
  const id = interaction.customId.split(":")[1];
  const tm = await prisma.ticketMedal.findUnique({ where: { id }, include: { ticket: true, medal: { include: { approvalRoles: true } } } });
  if (!tm || tm.ticket.requestGuildId !== interaction.guild.id) return true;
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: interaction.guild.id }, select: { staffRoleId: true } });
  if (!config?.staffRoleId || !member.roles.cache.has(config.staffRoleId) || !tm.medal.approvalRoles.some((r) => member.roles.cache.has(r.roleId))) {
    await interaction.reply({ content: "## 🔒 Permissão insuficiente\n\nVocê não pode negar esta medalha.", flags: MessageFlags.Ephemeral }); return true;
  }
  if (tm.status !== "PENDING") { await interaction.reply({ content: "⚠️ Esta medalha já foi analisada.", flags: MessageFlags.Ephemeral }); return true; }
  const reason = interaction.fields.getTextInputValue("reason").trim();
  const updated = await prisma.ticketMedal.update({ where: { id }, data: { status: "DENIED", decidedBy: interaction.user.id, reason }, include: { medal: true, ticket: true } });
  await logAuditEvent({ guild: interaction.guild, action: "MEDAL_DENIED", executorId: interaction.user.id, targetId: updated.ticket.userId, ticketId: updated.ticketId, medalId: updated.medalId, details: { ticketMedalId: updated.id, medalName: updated.medal.name, status: "DENIED", reason } });
  await interaction.reply({ content: "## 🔴 Medalha negada\n\nA decisão foi registrada e o solicitante será notificado.", flags: MessageFlags.Ephemeral });
  return true;
}
