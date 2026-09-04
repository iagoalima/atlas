import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ContainerBuilder,
  Message,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuInteraction,
} from "discord.js";
import { prisma } from "../infrastructure/database/prisma.js";
import { logAuditEvent } from "./audit-log.service.js";
import { getRequestState } from "./request-season.service.js";

const proofProcessingUsers = new Set<string>();

export async function handleRequestButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith("request_")) return false;
  if (!interaction.guild) return true;

  if (interaction.customId === "request_start") {
    const config = await prisma.guildConfig.findUnique({
      where: { requestGuildId: interaction.guild.id },
    });

    if (!config?.requestReviewChannelId || !config.requestPanelChannelId) {
      await interaction.reply({
        content: "## ⚙️ Sistema indisponível\n\nO Atlas ainda não possui a estrutura de solicitações configurada.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (!(await getRequestState(interaction.guild.id))) {
      await interaction.reply({
        content: "## 🔒 Solicitações fechadas\n\nA temporada atual está encerrada. As solicitações já enviadas continuam em análise normalmente.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const medals = await prisma.medal.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: [{ category: { position: "asc" } }, { name: "asc" }],
    });

    if (!medals.length) {
      await interaction.reply({
        content: "## ⚠️ Nenhuma medalha disponível\n\nNão existem medalhas disponíveis para solicitação neste momento.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`request_medals:${interaction.user.id}`)
      .setPlaceholder("Selecione de 1 a 3 medalhas")
      .setMinValues(1)
      .setMaxValues(Math.min(3, medals.length));

    for (const medal of medals) {
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(medal.name.slice(0, 100))
        .setValue(medal.id)
        .setDescription(medal.category.name.slice(0, 100));

      if (medal.emoji) option.setEmoji(medal.emoji);
      select.addOptions(option);
    }

    await interaction.reply({
      content: [
        "## 🎖️ Nova solicitação",
        "",
        "Selecione as medalhas que deseja solicitar.",
        "",
        "-# Você poderá enviar as provas separadamente para cada medalha na etapa seguinte.",
        "-# Limite: **1 a 3 medalhas** por solicitação.",
      ].join("\n"),
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  if (interaction.customId.startsWith("request_confirm:")) {
    const [, userId, ids] = interaction.customId.split(":");

    if (!userId || !ids) {
      await interaction.reply({
        content: "❌ Os dados desta solicitação estão incompletos. Abra uma nova solicitação.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: "❌ Esta solicitação pertence a outro usuário.",
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const modal = new ModalBuilder()
      .setCustomId(`request_identity:${userId}:${ids}`)
      .setTitle("Identificação da solicitação");

    const input = new TextInputBuilder()
      .setCustomId("roblox_username")
      .setLabel("Nome de usuário no Roblox")
      .setPlaceholder("Informe seu nome exatamente como aparece no Roblox")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(20);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  return false;
}

export async function handleRequestSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith("request_medals:")) return false;

  const [, userId] = interaction.customId.split(":");

  if (!userId) {
    await interaction.reply({
      content: "❌ Os dados desta solicitação estão incompletos. Abra uma nova solicitação.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: "❌ Este menu pertence a outro usuário.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const ids = interaction.values;
  const medals = await prisma.medal.findMany({
    where: { id: { in: ids }, active: true },
    include: { category: true },
  });

  if (medals.length !== ids.length) {
    await interaction.reply({
      content: "❌ Uma ou mais medalhas não estão mais disponíveis.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const ordered = ids
    .map((id) => medals.find((m) => m.id === id))
    .filter((m): m is (typeof medals)[number] => Boolean(m));

  const list = ordered
    .map((m, i) => `**${i + 1}.** ${m.emoji ?? "🎖️"} ${m.name}\n-# ${m.category.name}`)
    .join("\n\n");

  const confirm = new ButtonBuilder()
    .setCustomId(`request_confirm:${userId}:${ids.join(",")}`)
    .setLabel("Continuar")
    .setStyle(ButtonStyle.Success);

  const back = new ButtonBuilder()
    .setCustomId("request_start")
    .setLabel("Alterar seleção")
    .setStyle(ButtonStyle.Secondary);

  await interaction.update({
    content: [
      "## 🎖️ Confirmar solicitação",
      "",
      list,
      "",
      "Confira as medalhas antes de continuar.",
      "",
      "-# Na próxima etapa, o Atlas solicitará seu nome no Roblox e iniciará o envio das provas, uma medalha por vez.",
    ].join("\n"),
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(confirm, back)],
  });

  return true;
}

export async function handleRequestModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith("request_identity:")) return false;
  if (!interaction.guild) return true;

  const [, userId, idsString] = interaction.customId.split(":");

  if (!userId || !idsString) {
    await interaction.reply({
      content: "❌ Os dados desta solicitação estão incompletos. Abra uma nova solicitação.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: "❌ Esta solicitação pertence a outro usuário.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const robloxUsername = interaction.fields.getTextInputValue("roblox_username").trim();

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(robloxUsername)) {
    await interaction.reply({
      content: "❌ Informe um nome de Roblox válido (3 a 20 caracteres, apenas letras, números e `_`).",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const config = await prisma.guildConfig.findUnique({
    where: { requestGuildId: interaction.guild.id },
  });

  if (!config?.requestReviewChannelId) {
    await interaction.reply({
      content: "❌ O canal privado de análise ainda não está configurado.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (!(await getRequestState(interaction.guild.id))) {
    await interaction.reply({
      content: "## 🔒 Solicitações fechadas\n\nA temporada foi encerrada antes do envio desta solicitação.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const medalIds = [...new Set(idsString.split(",").filter(Boolean))];

  if (medalIds.length < 1 || medalIds.length > 3) {
    await interaction.reply({
      content: "❌ Quantidade de medalhas inválida.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const existing = await prisma.ticket.findFirst({
    where: {
      userId,
      status: "OPEN",
      requestGuildId: interaction.guild.id,
    },
  });

  if (existing) {
    await interaction.reply({
      content: "## ⚠️ Solicitação em andamento\n\nVocê já possui uma solicitação aguardando análise ou conclusão.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const member = await interaction.guild.members.fetch(userId);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const ticket = await prisma.ticket.create({
      data: {
        channelId: config.requestReviewChannelId,
        requestGuildId: interaction.guild.id,
        userId,
        username: interaction.user.username,
        nickname: member.nickname ?? member.displayName,
        robloxUsername,
        status: "OPEN",
        medals: {
          create: medalIds.map((medalId) => ({
            medalId,
            status: "PENDING",
          })),
        },
      },
      include: {
        medals: {
          include: {
            medal: {
              include: { category: true },
            },
          },
        },
      },
    });

    const first = ticket.medals[0];

    if (!first) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "DENIED",
          reason: "Nenhuma medalha válida foi encontrada para a solicitação.",
        },
      });

      await interaction.editReply({
        content: "## ❌ Não foi possível iniciar\n\nNenhuma medalha válida foi encontrada para esta solicitação.",
      });
      return true;
    }

    console.log(
      `🟢 [REQUEST] Solicitação #${ticket.ticketNumber} criada para ${interaction.user.tag}. Primeira medalha: ${first.medal.name}`
    );

    const dm = await interaction.user.createDM();

    await dm.send({
      content: [
        "## 📎 Envio de provas",
        "",
        `Sua solicitação **#${ticket.ticketNumber}** foi registrada.`,
        "",
        `Envie agora as provas da medalha **${first.medal.name}**.`,
        "",
        "Você pode enviar vários arquivos na mesma mensagem.",
        "",
        "-# Depois que as provas desta medalha forem recebidas, o Atlas solicitará automaticamente as provas da próxima.",
        "-# Não envie provas de medalhas diferentes na mesma etapa.",
      ].join("\n"),
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`request_proof_help:${ticket.id}`)
            .setLabel("Como enviar as provas")
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
    });

    await interaction.editReply({
      content: [
        "## 🟢 Solicitação registrada",
        "",
        "Sua solicitação foi registrada com sucesso.",
        "",
        "O Atlas enviou uma mensagem no seu privado para iniciar o envio das provas, uma medalha por vez.",
        "",
        "-# Após o envio completo, a solicitação será encaminhada à equipe responsável.",
      ].join("\n"),
    });

    await logAuditEvent({
      guild: interaction.guild,
      action: "TICKET_CREATED",
      executorId: userId,
      targetId: userId,
      ticketId: ticket.id,
      details: {
        requestModel: "seasonal",
        ticketNumber: ticket.ticketNumber,
        robloxUsername,
        medalNames: ticket.medals.map((m) => m.medal.name),
      },
    });
  } catch (error) {
    console.error("❌ [REQUEST] Erro ao iniciar coleta de provas:", error);

    await interaction.editReply({
      content: "## ❌ Não foi possível iniciar\n\nO Atlas não conseguiu iniciar a coleta das provas. Verifique se suas mensagens diretas estão habilitadas e tente novamente.",
    });
  }

  return true;
}

export async function handleRequestMessage(message: Message): Promise<boolean> {
  if (message.author.bot || message.guild) return false;

  console.log(
    `🟡 [REQUEST] Mensagem privada recebida de ${message.author.tag} (${message.attachments.size} anexo(s)).`
  );

  if (proofProcessingUsers.has(message.author.id)) {
    console.log(
      `🟡 [REQUEST] Ignorando mensagem simultânea de ${message.author.tag}; outra mensagem está sendo processada.`
    );
    return true;
  }

  proofProcessingUsers.add(message.author.id);

  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        userId: message.author.id,
        status: "OPEN",
        requestGuildId: { not: null },
      },
      include: {
        medals: {
          include: { medal: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!ticket) {
      console.log(
        `🟡 [REQUEST] Nenhuma solicitação sazonal aberta encontrada para ${message.author.tag}.`
      );
      return false;
    }

    if (ticket.proofCollectionIndex >= ticket.medals.length) {
      console.log(
        `🟡 [REQUEST] Solicitação #${ticket.ticketNumber} já concluiu a coleta de provas.`
      );
      return false;
    }

    const current = ticket.medals[ticket.proofCollectionIndex];

    if (!current) {
      console.error(
        `❌ [REQUEST] Não foi possível localizar a medalha atual da solicitação #${ticket.ticketNumber}.`
      );
      await message.author.send(
        "## ❌ Não foi possível continuar\n\nO Atlas não conseguiu identificar a medalha atual desta solicitação. A equipe responsável deverá verificar o registro."
      );
      return true;
    }

    console.log(
      `🟢 [REQUEST] Solicitação #${ticket.ticketNumber}: aguardando provas de ${current.medal.name}.`
    );

    if (!message.attachments.size) {
      await message.author.send({
        content: [
          "## 📎 Provas da medalha",
          "",
          `A etapa atual é **${current.medal.name}**.`,
          "",
          "Envie pelo menos um arquivo como prova nesta mensagem.",
          "",
          "-# Você pode enviar vários arquivos de uma vez.",
        ].join("\n"),
      });
      return true;
    }

    const attachmentData = [...message.attachments.values()].map((attachment) => ({
      ticketId: ticket.id,
      userId: message.author.id,
      messageId: message.id,
      channelId: message.channel.id,
      url: attachment.url,
      fileName: attachment.name ?? null,
      medalId: current.medalId,
    }));

    await prisma.$transaction(async (tx) => {
      await tx.ticketProof.createMany({ data: attachmentData });

      const nextIndex = ticket.proofCollectionIndex + 1;

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          proofCollectionIndex: nextIndex,
          ...(nextIndex === ticket.medals.length
            ? { proofsSubmittedAt: new Date() }
            : {}),
        },
      });
    });

    const nextIndex = ticket.proofCollectionIndex + 1;

    console.log(
      `✅ [REQUEST] Provas registradas para ${current.medal.name} na solicitação #${ticket.ticketNumber}. Próximo índice: ${nextIndex}.`
    );

    if (nextIndex < ticket.medals.length) {
      const next = ticket.medals[nextIndex];

      if (!next) {
        console.error(
          `❌ [REQUEST] Próxima medalha não encontrada na solicitação #${ticket.ticketNumber}.`
        );
        await message.author.send(
          "## ❌ Coleta interrompida\n\nAs provas foram registradas, mas o Atlas não conseguiu localizar a próxima medalha. A equipe responsável deverá verificar a solicitação."
        );
        return true;
      }

      await message.author.send({
        content: [
          "## 🟢 Provas registradas",
          "",
          `As provas de **${current.medal.name}** foram registradas com sucesso.`,
          "",
          "### 📎 Próxima etapa",
          "",
          `Agora envie as provas de **${next.medal.name}**.`,
          "",
          "-# Você pode enviar vários arquivos na mesma mensagem.",
          "-# O Atlas só avançará novamente depois que receber pelo menos uma prova desta medalha.",
        ].join("\n"),
      });

      return true;
    }

    await message.author.send({
      content: [
        "## 🟢 Provas recebidas",
        "",
        `Todas as provas da solicitação **#${ticket.ticketNumber}** foram registradas com sucesso.`,
        "",
        "Sua solicitação foi encaminhada para análise da equipe responsável.",
        "",
        "-# A partir de agora, aguarde a análise. Você será avisado pelo privado sobre cada decisão e sobre a entrega das medalhas aprovadas.",
      ].join("\n"),
    });

    if (ticket.requestGuildId) {
      await publishReviewRequest(
        message.client,
        ticket.id,
        ticket.requestGuildId
      );
    }

    return true;
  } catch (error) {
    console.error(
      `❌ [REQUEST] Erro ao processar provas privadas de ${message.author.tag}:`,
      error
    );

    try {
      await message.author.send(
        "## ❌ Não foi possível registrar as provas\n\nO Atlas encontrou um erro ao processar esta mensagem. **Não reenvie as provas imediatamente**; aguarde alguns instantes e tente novamente."
      );
    } catch (dmError) {
      console.error("❌ [REQUEST] Não foi possível enviar DM de erro:", dmError);
    }

    return true;
  } finally {
    proofProcessingUsers.delete(message.author.id);
  }
}

async function publishReviewRequest(
  client: Message["client"],
  ticketId: string,
  guildId: string
): Promise<void> {
  const config = await prisma.guildConfig.findUnique({
    where: { requestGuildId: guildId },
  });

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      medals: {
        include: {
          medal: {
            include: { category: true },
          },
        },
      },
    },
  });

  if (!config?.requestReviewChannelId || !ticket) return;

  const channel = await client.channels
    .fetch(config.requestReviewChannelId)
    .catch(() => null);

  if (!channel?.isTextBased() || !channel.isSendable()) return;

  const list = ticket.medals
    .map(
      (tm, i) =>
        `**${i + 1}.** ${tm.medal.emoji ?? "🎖️"} ${tm.medal.name} • ${tm.medal.category.name}`
    )
    .join("\n");

  const rows = ticket.medals.map((tm) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_medal_approve:${tm.id}`)
        .setLabel(`Aprovar ${tm.medal.name}`.slice(0, 80))
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ticket_medal_deny:${tm.id}`)
        .setLabel(`Negar ${tm.medal.name}`.slice(0, 80))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`ticket_medal_deliver:${tm.id}`)
        .setLabel(`Entregar ${tm.medal.name}`.slice(0, 80))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`ticket_medal_proofs:${tm.id}`)
        .setLabel("Visualizar provas")
        .setStyle(ButtonStyle.Secondary)
    )
  );

  const container = new ContainerBuilder()
    .setAccentColor(0x3498db)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "# 🎖️ Nova solicitação",
          "",
          `👤 **Solicitante:** <@${ticket.userId}>`,
          `🎮 **Roblox:** \`${ticket.robloxUsername}\``,
          `🆔 **Solicitação:** #${ticket.ticketNumber}`,
        ].join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        ["## 🏅 Medalhas solicitadas", "", list].join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "## 📎 Provas",
          "",
          "As provas foram coletadas separadamente para cada medalha.",
          "Use **Visualizar provas** para consultar somente as provas daquela medalha.",
        ].join("\n")
      )
    );

  for (const row of rows) container.addActionRowComponents(row);

  await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

export async function handleProofView(
  interaction: ButtonInteraction
): Promise<boolean> {
  if (!interaction.customId.startsWith("ticket_medal_proofs:")) return false;
  if (!interaction.guild) return true;

  const [, id] = interaction.customId.split(":");

  if (!id) {
    await interaction.reply({
      content: "❌ Provas não encontradas para esta solicitação.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const tm = await prisma.ticketMedal.findUnique({
    where: { id },
    include: { medal: true, ticket: true },
  });

  if (!tm || tm.ticket.channelId !== interaction.channelId) {
    await interaction.reply({
      content: "❌ Provas não encontradas para esta solicitação.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const proofs = await prisma.ticketProof.findMany({
    where: {
      ticketId: tm.ticketId,
      medalId: tm.medalId,
    },
    orderBy: { createdAt: "asc" },
  });

  const lines = proofs.length
    ? proofs
        .map(
          (p, i) =>
            `${i + 1}. [${p.fileName ?? "Arquivo"}](${p.url})`
        )
        .join("\n")
    : "-# Nenhuma prova registrada.";

  await interaction.reply({
    content: [
      "## 📎 Provas da medalha",
      "",
      `🏅 **${tm.medal.name}**`,
      "",
      lines,
    ].join("\n"),
    flags: MessageFlags.Ephemeral,
  });

  return true;
}
