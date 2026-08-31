import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";

import { prisma } from "../../infrastructure/database/prisma.js";
import {
  buildDraftReview,
  buildProofModal,
  createDraftSolicitation,
  getProofProgress,
  refreshTeamMessage,
  saveProofsFromModal,
  submitSolicitation,
  viewProofs,
} from "../../services/solicitation.service.js";

export async function handleTicketButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Esta ação só pode ser utilizada dentro de um servidor.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (interaction.customId === "ticket_request_medals" || interaction.customId === "ticket_open") {
    await handleSolicitationStart(interaction);
    return;
  }

  if (interaction.customId.startsWith("solicitation_proofs:")) {
    const [, ticketId, ticketMedalId] = interaction.customId.split(":");
    if (!ticketId || !ticketMedalId) throw new Error("Solicitação de provas inválida.");

    const item = await prisma.ticketMedal.findUnique({ where: { id: ticketMedalId }, include: { medal: true, ticket: true } });
    if (!item || item.ticketId !== ticketId || item.ticket.userId !== interaction.user.id || item.ticket.submittedAt) {
      throw new Error("Você não pode alterar esta solicitação.");
    }

    await interaction.showModal(buildProofModal(ticketId, ticketMedalId, item.medal.name));
    return;
  }

  if (interaction.customId.startsWith("solicitation_submit:")) {
    const ticketId = interaction.customId.split(":")[1];
    if (!ticketId) throw new Error("Solicitação inválida.");
    await submitSolicitation(interaction, ticketId);
    await interaction.update({ content: "## 📨 Solicitação enviada\n\nSua solicitação foi encaminhada para a equipe. Aguarde as próximas atualizações no privado.", components: [] });
    return;
  }

  if (interaction.customId.startsWith("solicitation_cancel:")) {
    const ticketId = interaction.customId.split(":")[1];
    if (!ticketId) throw new Error("Solicitação inválida.");
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.userId !== interaction.user.id || ticket.submittedAt) throw new Error("Esta solicitação não pode mais ser cancelada.");
    await prisma.ticket.delete({ where: { id: ticketId } });
    await interaction.update({ content: "## 🗑️ Solicitação cancelada\n\nNenhuma solicitação foi enviada para a equipe.", components: [] });
    return;
  }

  if (interaction.customId.startsWith("solicitation_view_proofs:")) {
    const ticketId = interaction.customId.split(":")[1];
    if (!ticketId) throw new Error("Solicitação inválida.");
    await viewProofs(interaction, ticketId);
    return;
  }

  if (interaction.customId.startsWith("ticket_medal_approve:")) {
    await handleApprove(interaction, interaction.customId.split(":")[1]);
    return;
  }

  if (interaction.customId.startsWith("ticket_medal_deny:")) {
    await handleDeny(interaction, interaction.customId.split(":")[1]);
    return;
  }

  if (interaction.customId.startsWith("ticket_medal_deliver:")) {
    await handleDeliver(interaction, interaction.customId.split(":")[1]);
  }
}

async function handleSolicitationStart(interaction: ButtonInteraction) {
  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: interaction.guild!.id } });
  if (!config?.solicitationsOpen) {
    await interaction.reply({ content: "## 🔒 Solicitações encerradas\n\nO período de envio está temporariamente fechado. As solicitações já enviadas continuam em análise normalmente.", flags: MessageFlags.Ephemeral });
    return;
  }

  const medals = await prisma.medal.findMany({
    where: { active: true },
    include: { category: true },
    orderBy: [{ category: { position: "asc" } }, { categoryId: "asc" }, { name: "asc" }],
  });

  if (!medals.length) {
    await interaction.reply({ content: "❌ Não existem medalhas disponíveis para solicitação.", flags: MessageFlags.Ephemeral });
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`solicitation_medal_select:${interaction.user.id}`)
    .setPlaceholder("Selecione de 1 a 3 medalhas")
    .setMinValues(1)
    .setMaxValues(Math.min(3, medals.length));

  for (const medal of medals.slice(0, 25)) {
    select.addOptions(new StringSelectMenuOptionBuilder()
      .setLabel(medal.name.slice(0, 100))
      .setValue(medal.id)
      .setDescription((medal.category?.name ?? "Sem categoria").slice(0, 100))
      .setEmoji(medal.emoji ?? "🏅"));
  }

  await interaction.reply({
    content: [
      "# 🎖️ Nova solicitação",
      "",
      "Selecione as medalhas que deseja solicitar.",
      "",
      "As medalhas aparecem agrupadas pela ordem das categorias e, dentro de cada categoria, em ordem alfabética.",
      "",
      "-# Você poderá solicitar no máximo 3 medalhas por solicitação.",
    ].join("\n"),
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleSolicitationMedalSelect(interaction: import("discord.js").StringSelectMenuInteraction) {
  const [, userId] = interaction.customId.split(":");
  if (userId !== interaction.user.id) {
    await interaction.reply({ content: "❌ Esta seleção pertence a outro usuário.", flags: MessageFlags.Ephemeral });
    return;
  }

  const medalIds = [...new Set(interaction.values)];
  const ticket = await createDraftSolicitation(interaction as unknown as ButtonInteraction, medalIds);
  const medals = await getProofProgress(ticket.id);
  const first = medals.find((item) => item.proofs.length === 0);
  if (!first) throw new Error("Não foi possível preparar a primeira etapa de provas.");

  await interaction.update({
    content: [
      "# 📎 Envio das provas",
      "",
      `**Solicitação:** #${ticket.ticketNumber}`,
      `**Próxima medalha:** ${first.medal.name}`,
      "",
      "Cada medalha possui uma etapa própria de provas. Envie somente os arquivos referentes à medalha indicada.",
      "",
      "Depois de concluir uma medalha, o Atlas liberará a próxima.",
    ].join("\n"),
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`solicitation_proofs:${ticket.id}:${first.id}`).setLabel("Anexar provas").setEmoji("📎").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`solicitation_cancel:${ticket.id}`).setLabel("Cancelar").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
    )],
  });
}

export async function handleSolicitationProofModal(interaction: import("discord.js").ModalSubmitInteraction) {
  await saveProofsFromModal(interaction);
  const parts = interaction.customId.split(":");
  const ticketId = parts[1];
  if (!ticketId) throw new Error("Solicitação inválida.");

  const medals = await getProofProgress(ticketId);
  const next = medals.find((item) => item.proofs.length === 0);

  if (next) {
    await interaction.reply({
      content: [
        "## 📎 Provas registradas",
        "",
        "As provas desta etapa foram registradas com sucesso.",
        "",
        `Agora envie as provas de **${next.medal.name}**.`,
      ].join("\n"),
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`solicitation_proofs:${ticketId}:${next.id}`).setLabel("Anexar próximas provas").setEmoji("📎").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`solicitation_cancel:${ticketId}`).setLabel("Cancelar").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
      )],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    ...(await buildDraftReview(ticketId)),
    flags: MessageFlags.Ephemeral,
  });
}

async function requireStaff(interaction: ButtonInteraction) {
  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: interaction.guild!.id } });
  if (!config) throw new Error("Configuração do Atlas não encontrada.");
  const member = await interaction.guild!.members.fetch(interaction.user.id);
  if (!member.roles.cache.has(config.staffRoleId)) throw new Error("Apenas membros da equipe podem analisar solicitações.");
  return { config, member };
}

async function handleApprove(interaction: ButtonInteraction, ticketMedalId?: string) {
  if (!ticketMedalId) throw new Error("Medalha inválida.");
  const { member } = await requireStaff(interaction);
  const item = await prisma.ticketMedal.findUnique({ where: { id: ticketMedalId }, include: { medal: { include: { approvalRoles: true } }, ticket: true } });
  if (!item) throw new Error("Medalha não encontrada.");
  if (item.status !== "PENDING") throw new Error("Esta medalha já foi analisada.");
  if (!item.medal.approvalRoles.some((role) => member.roles.cache.has(role.roleId))) throw new Error("Você não possui permissão específica para aprovar esta medalha.");

  const approved = await prisma.ticketMedal.update({ where: { id: item.id }, data: { status: "APPROVED", decidedBy: interaction.user.id, reason: null }, include: { medal: true, ticket: true } });
  await prisma.ticket.update({ where: { id: approved.ticketId }, data: { staffId: interaction.user.id } });

  await prisma.auditLog.create({ data: {
    action: "MEDAL_APPROVED",
    executorId: interaction.user.id,
    targetId: approved.ticket.userId,
    ticketId: approved.ticketId,
    medalId: approved.medalId,
    details: { solicitation: true, ticketMedalId: approved.id, medalName: approved.medal.name },
  }});

  try {
    const user = await interaction.client.users.fetch(approved.ticket.userId);
    await user.send(`## 🟢 Medalha aprovada\n\nSua medalha **${approved.medal.name}** foi aprovada e está aguardando a entrega efetiva.`);
  } catch {}

  await refreshTeamMessage(interaction.guild!, approved.ticketId);
  await interaction.reply({ content: `## 🟢 Medalha aprovada\n\n**${approved.medal.name}** foi aprovada com sucesso.`, flags: MessageFlags.Ephemeral });
}

async function handleDeny(interaction: ButtonInteraction, ticketMedalId?: string) {
  if (!ticketMedalId) throw new Error("Medalha inválida.");
  await requireStaff(interaction);

  const item = await prisma.ticketMedal.findUnique({ where: { id: ticketMedalId }, include: { medal: true } });
  if (!item || item.status !== "PENDING") throw new Error("Esta medalha já foi analisada.");

  const { ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle } = await import("discord.js");
  const modal = new ModalBuilder()
    .setCustomId(`solicitation_deny_modal:${ticketMedalId}`)
    .setTitle(`Negar — ${item.medal.name}`.slice(0, 45))
    .addLabelComponents(new LabelBuilder()
      .setLabel("Motivo da negativa")
      .setDescription("Explique claramente o motivo da decisão.")
      .setTextInputComponent(new TextInputBuilder()
        .setCustomId("deny_reason")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(1000)));

  await interaction.showModal(modal);
}

export async function handleDenialModal(interaction: import("discord.js").ModalSubmitInteraction) {
  const ticketMedalId = interaction.customId.split(":")[1];
  if (!ticketMedalId || !interaction.guild) throw new Error("Negativa inválida.");
  const config = await prisma.guildConfig.findUniqueOrThrow({ where: { requestGuildId: interaction.guild.id } });
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.roles.cache.has(config.staffRoleId)) throw new Error("Apenas a equipe pode negar medalhas.");

  const item = await prisma.ticketMedal.findUnique({ where: { id: ticketMedalId }, include: { medal: { include: { approvalRoles: true } }, ticket: true } });
  if (!item || item.status !== "PENDING") throw new Error("Esta medalha já foi analisada.");
  if (!item.medal.approvalRoles.some((role) => member.roles.cache.has(role.roleId))) throw new Error("Você não possui permissão específica para negar esta medalha.");

  const reason = interaction.fields.getTextInputValue("deny_reason").trim();
  const denied = await prisma.ticketMedal.update({ where: { id: item.id }, data: { status: "DENIED", decidedBy: interaction.user.id, reason }, include: { medal: true, ticket: true } });

  await prisma.auditLog.create({ data: {
    action: "MEDAL_DENIED",
    executorId: interaction.user.id,
    targetId: denied.ticket.userId,
    ticketId: denied.ticketId,
    medalId: denied.medalId,
    details: { solicitation: true, ticketMedalId: denied.id, medalName: denied.medal.name, reason },
  }});

  try {
    const user = await interaction.client.users.fetch(denied.ticket.userId);
    await user.send(`## 🔴 Medalha não aprovada\n\nSua solicitação para **${denied.medal.name}** não foi aprovada.\n\n**Motivo:**\n${reason}`);
  } catch {}

  await refreshTeamMessage(interaction.guild, denied.ticketId);
  await interaction.reply({ content: `## 🔴 Medalha negada\n\n**${denied.medal.name}** foi negada.`, flags: MessageFlags.Ephemeral });
}

async function handleDeliver(interaction: ButtonInteraction, ticketMedalId?: string) {
  if (!ticketMedalId) throw new Error("Medalha inválida.");
  const item = await prisma.ticketMedal.findUnique({ where: { id: ticketMedalId }, include: { medal: true, ticket: true } });
  if (!item || item.status !== "APPROVED") throw new Error("Somente medalhas aprovadas podem ser entregues.");

  const { deliverMedal } = await import("../../services/medal-delivery.service.js");
  const result = await deliverMedal({ client: interaction.client, ticketMedalId, executorId: interaction.user.id, requestGuildId: interaction.guild!.id });

  await refreshTeamMessage(interaction.guild!, item.ticketId);
  try {
    const user = await interaction.client.users.fetch(item.ticket.userId);
    await user.send(`## 🏅 Medalha entregue\n\nA medalha **${item.medal.name}** foi efetivamente entregue no servidor do EB.`);
  } catch {}

  await interaction.reply({ content: `## 🏅 Medalha entregue\n\n**${item.medal.name}** foi entregue com sucesso.\n\n${result.addedRoleNames.length ? `Cargos adicionados: ${result.addedRoleNames.map((name) => `\`${name}\``).join(", ")}` : "O usuário já possuía os cargos da medalha."}`, flags: MessageFlags.Ephemeral });
}
