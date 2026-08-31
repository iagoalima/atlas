import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  FileUploadBuilder,
  Guild,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
} from "discord.js";

import { prisma } from "../infrastructure/database/prisma.js";
import { deliverMedal } from "./medal-delivery.service.js";
import { logAuditEvent } from "./audit-log.service.js";

const NOTICE_TTL_MS = 3 * 60 * 60 * 1000;

function getTeamChannelId(config: { solicitationChannelId: string | null; transcriptChannelId: string }) {
  return config.solicitationChannelId ?? config.transcriptChannelId;
}

async function getTeamChannel(guild: Guild) {
  const config = await prisma.guildConfig.findUnique({
    where: { requestGuildId: guild.id },
  });

  if (!config) throw new Error("Configuração do Atlas não encontrada.");

  const channelId = getTeamChannelId(config);
  const channel = await guild.channels.fetch(channelId);

  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error("O canal privado de solicitações não foi encontrado ou não é um canal de texto.");
  }

  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    ViewChannel: false,
  });

  await channel.permissionOverwrites.edit(guild.client.user.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
    EmbedLinks: true,
    ManageMessages: true,
  });

  await channel.permissionOverwrites.edit(config.staffRoleId, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
    EmbedLinks: true,
  });

  if (config.responsibleRoleId) {
    await channel.permissionOverwrites.edit(config.responsibleRoleId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true,
    });
  }

  return { channel, config };
}

export async function ensureSolicitationChannel(guild: Guild, channelId: string) {
  const config = await prisma.guildConfig.findUnique({
    where: { requestGuildId: guild.id },
  });
  if (!config) throw new Error("Configuração do Atlas não encontrada.");

  const channel = await guild.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error("O canal informado não é um canal de texto válido.");
  }

  await prisma.guildConfig.update({
    where: { requestGuildId: guild.id },
    data: { solicitationChannelId: channel.id },
  });

  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    ViewChannel: false,
  });
  await channel.permissionOverwrites.edit(guild.client.user.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
    EmbedLinks: true,
    ManageMessages: true,
  });
  await channel.permissionOverwrites.edit(config.staffRoleId, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
    EmbedLinks: true,
  });
  if (config.responsibleRoleId) {
    await channel.permissionOverwrites.edit(config.responsibleRoleId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true,
    });
  }

  return channel;
}

export async function buildSolicitationPanel(guild: Guild) {
  const config = await prisma.guildConfig.findUnique({
    where: { requestGuildId: guild.id },
  });

  const open = config?.solicitationsOpen ?? false;

  const button = new ButtonBuilder()
    .setCustomId("ticket_request_medals")
    .setLabel(open ? "Solicitar medalhas" : "Solicitações encerradas")
    .setEmoji(open ? "🎖️" : "🔒")
    .setStyle(open ? ButtonStyle.Primary : ButtonStyle.Secondary)
    .setDisabled(!open);

  return [
    new TextDisplayBuilder().setContent([
      "# 🎖️ SOLICITAÇÕES DE MEDALHAS",
      "",
      open
        ? "O período de solicitações está **aberto**. Você pode iniciar uma nova solicitação pelo botão abaixo."
        : "O período de solicitações está **encerrado** no momento. As solicitações já enviadas continuam sendo analisadas normalmente.",
      "",
      "## 📋 Como funciona",
      "",
      "**1.** Escolha de 1 a 3 medalhas.",
      "**2.** Envie as provas da primeira medalha.",
      "**3.** Envie as provas de cada medalha separadamente.",
      "**4.** Revise tudo e confirme o envio.",
      "**5.** A equipe analisará cada medalha individualmente.",
      "**6.** Você receberá atualizações no privado sobre aprovação, negativa e entrega.",
      "",
      "## 📎 Suas obrigações",
      "",
      "• As provas devem corresponder à medalha escolhida;",
      "• Não misture provas de medalhas diferentes;",
      "• Envie arquivos legíveis e suficientes para análise;",
      "• A solicitação não garante aprovação;",
      "• Informações ou provas insuficientes podem resultar em negativa.",
      "",
      "-# O Atlas registra cada etapa da solicitação para fins de controle e auditoria.",
    ].join("\n")),
    new ActionRowBuilder<ButtonBuilder>().addComponents(button),
  ];
}

export async function openSolicitations(guild: Guild) {
  const config = await prisma.guildConfig.findUnique({
    where: { requestGuildId: guild.id },
  });
  if (!config) throw new Error("Configuração do Atlas não encontrada.");

  const updated = await prisma.guildConfig.update({
    where: { requestGuildId: guild.id },
    data: { solicitationsOpen: true },
  });

  const channel = config.ticketPanelChannelId
    ? await guild.channels.fetch(config.ticketPanelChannelId)
    : null;

  if (channel?.isTextBased()) {
    const message = await channel.send({
      content: "## 🟢 SOLICITAÇÕES REABERTAS\n\nO período para envio de novas solicitações de medalhas foi retomado.\n\nAs solicitações anteriores continuam em análise normalmente.",
    });

    const deleteAt = new Date(Date.now() + NOTICE_TTL_MS);
    await prisma.guildConfig.update({
      where: { requestGuildId: guild.id },
      data: {
        solicitationNoticeMessageId: message.id,
        solicitationNoticeDeleteAt: deleteAt,
      },
    });

    setTimeout(async () => {
      try {
        await message.delete();
        await prisma.guildConfig.update({
          where: { requestGuildId: guild.id },
          data: {
            solicitationNoticeMessageId: null,
            solicitationNoticeDeleteAt: null,
          },
        });
      } catch {}
    }, NOTICE_TTL_MS);
  }

  await logAuditEvent({
    guild,
    action: "CONFIG_UPDATED",
    executorId: guild.client.user.id,
    details: {
      event: "SOLICITATIONS_OPENED",
      open: true,
    },
  });

  return updated;
}

export async function closeSolicitations(guild: Guild) {
  const updated = await prisma.guildConfig.update({
    where: { requestGuildId: guild.id },
    data: { solicitationsOpen: false },
  });

  await logAuditEvent({
    guild,
    action: "CONFIG_UPDATED",
    executorId: guild.client.user.id,
    details: {
      event: "SOLICITATIONS_CLOSED",
      open: false,
      note: "Solicitações existentes continuam em análise.",
    },
  });

  return updated;
}

export async function cleanupSolicitationNotice(guild: Guild) {
  const config = await prisma.guildConfig.findUnique({
    where: { requestGuildId: guild.id },
  });
  if (!config?.solicitationNoticeMessageId || !config.solicitationNoticeDeleteAt) return;
  if (config.solicitationNoticeDeleteAt.getTime() > Date.now()) return;

  if (config.ticketPanelChannelId) {
    try {
      const channel = await guild.channels.fetch(config.ticketPanelChannelId);
      if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(config.solicitationNoticeMessageId);
        await message.delete();
      }
    } catch {}
  }

  await prisma.guildConfig.update({
    where: { requestGuildId: guild.id },
    data: {
      solicitationNoticeMessageId: null,
      solicitationNoticeDeleteAt: null,
    },
  });
}

export function buildProofModal(ticketId: string, ticketMedalId: string, medalName: string) {
  const upload = new FileUploadBuilder()
    .setCustomId("proof_files")
    .setMinValues(1)
    .setMaxValues(10)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(`solicitation_proofs_modal:${ticketId}:${ticketMedalId}`)
    .setTitle(`Provas — ${medalName}`.slice(0, 45))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent([
        `# 📎 Provas — ${medalName}`,
        "",
        "Envie todas as provas referentes **somente a esta medalha**.",
        "",
        "Você pode anexar até **10 arquivos** nesta etapa.",
        "",
        "-# Depois de enviar, o Atlas registrará os arquivos e liberará a próxima etapa.",
      ].join("\n"))
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Arquivos das provas")
        .setDescription("Imagens, vídeos e outros arquivos aceitos pelo Discord.")
        .setFileUploadComponent(upload)
    );
}

export async function createDraftSolicitation(
  interaction: ButtonInteraction,
  medalIds: string[],
) {
  if (!interaction.guild) throw new Error("Servidor não encontrado.");

  const config = await prisma.guildConfig.findUnique({
    where: { requestGuildId: interaction.guild.id },
  });
  if (!config?.solicitationsOpen) throw new Error("As solicitações estão encerradas.");

  const existing = await prisma.ticket.findFirst({
    where: {
      userId: interaction.user.id,
      status: "OPEN",
    },
    include: { medals: true },
  });

  if (existing) {
    if (!existing.submittedAt) {
      await prisma.ticket.delete({ where: { id: existing.id } });
    } else {
      throw new Error("Você já possui uma solicitação em andamento.");
    }
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const medals = await prisma.medal.findMany({
    where: { id: { in: medalIds }, active: true },
    include: { category: true },
  });

  if (medals.length !== medalIds.length) throw new Error("Uma ou mais medalhas não estão mais disponíveis.");

  const teamChannelId = getTeamChannelId(config);
  const ticket = await prisma.ticket.create({
    data: {
      channelId: teamChannelId,
      userId: interaction.user.id,
      username: interaction.user.username,
      nickname: member.displayName,
      robloxUsername: "N/A",
      status: "OPEN",
      medals: {
        create: medalIds.map((medalId) => ({ medalId, status: "PENDING" })),
      },
    },
    include: {
      medals: { include: { medal: { include: { category: true } } } },
    },
  });

  await logAuditEvent({
    guild: interaction.guild,
    action: "TICKET_CREATED",
    executorId: interaction.user.id,
    targetId: interaction.user.id,
    ticketId: ticket.id,
    details: {
      solicitation: true,
      ticketNumber: ticket.ticketNumber,
      medalIds,
    },
  });

  return ticket;
}

export async function saveProofsFromModal(interaction: ModalSubmitInteraction) {
  const parts = interaction.customId.split(":");
  const ticketId = parts[1];
  const ticketMedalId = parts[2];
  if (!ticketId || !ticketMedalId || !interaction.guild) throw new Error("Solicitação inválida.");

  const ticketMedal = await prisma.ticketMedal.findUnique({
    where: { id: ticketMedalId },
    include: { medal: true, ticket: true },
  });

  if (!ticketMedal || ticketMedal.ticketId !== ticketId) throw new Error("Medalha não encontrada.");
  if (ticketMedal.ticket.userId !== interaction.user.id) throw new Error("Esta solicitação pertence a outro usuário.");

  const attachments = interaction.fields.getUploadedFiles("proof_files", true);
  if (!attachments || attachments.size === 0) throw new Error("Nenhuma prova foi anexada.");

  await prisma.ticketProof.createMany({
    data: [...attachments.values()].map((attachment) => ({
      ticketId,
      ticketMedalId,
      medalId: ticketMedal.medalId,
      userId: interaction.user.id,
      messageId: interaction.id,
      channelId: getTeamChannelId(
        await prisma.guildConfig.findUniqueOrThrow({ where: { requestGuildId: interaction.guild!.id } })
      ),
      url: attachment.url,
      fileName: attachment.name,
    })),
  });

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { proofsSubmittedAt: new Date() },
  });

  return ticketMedal;
}

export async function getProofProgress(ticketId: string) {
  return prisma.ticketMedal.findMany({
    where: { ticketId },
    include: {
      medal: { include: { category: true } },
      proofs: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

async function allProofsSubmitted(ticketId: string) {
  const medals = await getProofProgress(ticketId);
  return medals.length > 0 && medals.every((medal) => medal.proofs.length > 0);
}

export async function buildDraftReview(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      medals: {
        include: { medal: { include: { category: true } }, proofs: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!ticket) throw new Error("Solicitação não encontrada.");

  const medalLines = ticket.medals.map((item) =>
    `${item.medal.emoji ?? "🏅"} **${item.medal.name}** — ${item.proofs.length} prova(s) — ${item.medal.category?.name ?? "Sem categoria"}`
  );

  const submitButton = new ButtonBuilder()
    .setCustomId(`solicitation_submit:${ticket.id}`)
    .setLabel("Enviar solicitação")
    .setEmoji("📨")
    .setStyle(ButtonStyle.Success);

  return {
    components: [
      new TextDisplayBuilder().setContent([
        "# 📋 Revisão da solicitação",
        "",
        `**Solicitação:** #${ticket.ticketNumber}`,
        `**Solicitante:** <@${ticket.userId}>`,
        "",
        "## 🏅 Medalhas",
        "",
        medalLines.join("\n"),
        "",
        "Revise cuidadosamente as medalhas e as provas antes de enviar.",
        "",
        "-# Depois do envio, a solicitação será encaminhada para a equipe e não poderá ser alterada.",
      ].join("\n")),
      new ActionRowBuilder<ButtonBuilder>().addComponents(submitButton),
    ],
  };
}

export async function submitSolicitation(interaction: ButtonInteraction, ticketId: string) {
  if (!interaction.guild) throw new Error("Servidor não encontrado.");

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      medals: {
        include: { medal: { include: { category: true } }, proofs: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket || ticket.userId !== interaction.user.id) throw new Error("Solicitação não encontrada.");
  if (ticket.submittedAt) throw new Error("Esta solicitação já foi enviada.");
  if (!(await allProofsSubmitted(ticketId))) throw new Error("Todas as medalhas precisam ter pelo menos uma prova.");

  const { channel, config } = await getTeamChannel(interaction.guild);

  const medalSummary = ticket.medals.map((item) => [
    `${item.medal.emoji ?? "🏅"} **${item.medal.name}**`,
    `-# Categoria: ${item.medal.category?.name ?? "Sem categoria"}`,
    `📎 ${item.proofs.length} prova(s)`,
  ].join("\n")).join("\n\n");

  const container = [
    new TextDisplayBuilder().setContent([
      `# 📋 SOLICITAÇÃO #${ticket.ticketNumber}`,
      "",
      `👤 **Solicitante:** <@${ticket.userId}> | **${ticket.nickname ?? ticket.username}**`,
      `🕒 **Enviada:** <t:${Math.floor(Date.now() / 1000)}:F>`,
      "",
      "## 🏅 Medalhas solicitadas",
      "",
      medalSummary,
      "",
      "## 📊 Status",
      "",
      "🟡 **Aguardando análise**",
      "",
      "-# Cada medalha deve ser analisada individualmente. As provas estão separadas por medalha.",
    ].join("\n")),
  ];

  const viewButton = new ButtonBuilder()
    .setCustomId(`solicitation_view_proofs:${ticket.id}`)
    .setLabel("Visualizar provas")
    .setEmoji("📎")
    .setStyle(ButtonStyle.Secondary);

  container.push(new ActionRowBuilder<ButtonBuilder>().addComponents(viewButton));

  for (const item of ticket.medals) {
    const approve = new ButtonBuilder()
      .setCustomId(`ticket_medal_approve:${item.id}`)
      .setLabel(`Aprovar ${item.medal.name}`.slice(0, 80))
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success);
    const deny = new ButtonBuilder()
      .setCustomId(`ticket_medal_deny:${item.id}`)
      .setLabel(`Negar ${item.medal.name}`.slice(0, 80))
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger);
    const deliver = new ButtonBuilder()
      .setCustomId(`ticket_medal_deliver:${item.id}`)
      .setLabel(`Entregar ${item.medal.name}`.slice(0, 80))
      .setEmoji("🏅")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);

    container.push(new ActionRowBuilder<ButtonBuilder>().addComponents(approve, deny, deliver));
  }

  const message = await channel.send({
    components: container,
    flags: MessageFlags.IsComponentsV2,
  });

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { submittedAt: new Date(), teamMessageId: message.id },
  });

  await interaction.user.send({
    content: [
      "## 📨 Solicitação recebida",
      "",
      `Sua solicitação **#${ticket.ticketNumber}** foi enviada para a equipe.`,
      "",
      `🏅 **${ticket.medals.length} medalha(s)** aguardando análise.`,
      "",
      "Aguarde. Você receberá novas mensagens quando houver decisões e quando as medalhas forem efetivamente entregues.",
    ].join("\n"),
  }).catch(() => undefined);

  await logAuditEvent({
    guild: interaction.guild,
    action: "TICKET_CREATED",
    executorId: interaction.user.id,
    targetId: interaction.user.id,
    ticketId: ticket.id,
    details: {
      solicitation: true,
      submitted: true,
      ticketNumber: ticket.ticketNumber,
      teamChannelId: channel.id,
      teamMessageId: message.id,
    },
  });

  return { ticket, message, config };
}

export async function viewProofs(interaction: ButtonInteraction, ticketId: string) {
  if (!interaction.guild) throw new Error("Servidor não encontrado.");

  const config = await prisma.guildConfig.findUnique({
    where: { requestGuildId: interaction.guild.id },
  });
  if (!config) throw new Error("Configuração não encontrada.");

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const isStaff = member.roles.cache.has(config.staffRoleId) ||
    (!!config.responsibleRoleId && member.roles.cache.has(config.responsibleRoleId));
  if (!isStaff) throw new Error("Apenas a equipe pode visualizar as provas.");

  const medals = await getProofProgress(ticketId);
  const select = new StringSelectMenuBuilder()
    .setCustomId(`solicitation_proofs_select:${ticketId}`)
    .setPlaceholder("Escolha a medalha para visualizar as provas")
    .setMinValues(1)
    .setMaxValues(1);

  for (const item of medals) {
    select.addOptions(new StringSelectMenuOptionBuilder()
      .setLabel(item.medal.name.slice(0, 100))
      .setValue(item.medalId)
      .setDescription(`${item.proofs.length} prova(s) • ${item.medal.category?.name ?? "Sem categoria"}`)
      .setEmoji(item.medal.emoji ?? "📎"));
  }

  await interaction.reply({
    content: [
      "## 📎 Visualizar provas",
      "",
      "Selecione uma medalha para visualizar exclusivamente as provas enviadas para ela.",
    ].join("\n"),
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  });
}

export async function viewProofsForMedal(interaction: import("discord.js").StringSelectMenuInteraction) {
  const parts = interaction.customId.split(":");
  const ticketId = parts[1];
  const medalId = interaction.values[0];
  if (!ticketId || !medalId || !interaction.guild) throw new Error("Seleção inválida.");

  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: interaction.guild.id } });
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const isStaff = !!config && (member.roles.cache.has(config.staffRoleId) || (!!config.responsibleRoleId && member.roles.cache.has(config.responsibleRoleId)));
  if (!isStaff) throw new Error("Acesso restrito à equipe.");

  const item = await prisma.ticketMedal.findFirst({
    where: { ticketId, medalId },
    include: { medal: { include: { category: true } }, proofs: true },
  });
  if (!item) throw new Error("Medalha não encontrada.");

  const lines = item.proofs.length
    ? item.proofs.map((proof, index) => `${index + 1}. [${proof.fileName ?? "Abrir prova"}](${proof.url})`).join("\n")
    : "Nenhuma prova registrada.";

  await interaction.update({
    content: [
      `## 📎 Provas — ${item.medal.name}`,
      "",
      `**Categoria:** ${item.medal.category?.name ?? "Sem categoria"}`,
      `**Quantidade:** ${item.proofs.length}`,
      "",
      lines,
    ].join("\n"),
    components: [],
  });
}

export async function sendDecisionDM(userId: string, content: string) {
  try {
    const user = await import("discord.js").then(({ User }) => User);
    void user;
  } catch {}
}

export async function notifyApproval(userId: string, medalName: string) {
  try {
    const client = (await import("../core/discord/client.js")).client;
    const user = await client.users.fetch(userId);
    await user.send(`## 🟢 Medalha aprovada\n\nSua medalha **${medalName}** foi aprovada pela equipe e está aguardando a entrega efetiva.`);
  } catch {}
}

export async function notifyDenial(userId: string, medalName: string, reason: string) {
  try {
    const client = (await import("../core/discord/client.js")).client;
    const user = await client.users.fetch(userId);
    await user.send(`## 🔴 Medalha não aprovada\n\nSua solicitação para **${medalName}** não foi aprovada.\n\n**Motivo:**\n${reason}`);
  } catch {}
}

export async function notifyDelivery(userId: string, medalName: string) {
  try {
    const client = (await import("../core/discord/client.js")).client;
    const user = await client.users.fetch(userId);
    await user.send(`## 🏅 Medalha entregue\n\nA medalha **${medalName}** foi efetivamente entregue no servidor do EB.`);
  } catch {}
}
