import {
  AuditAction,
  Prisma,
} from "../generated/prisma/client.js";
import {
  ContainerBuilder,
  Guild,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from "discord.js";
import { prisma } from "../infrastructure/database/prisma.js";

// ==========================================================
// TIPOS
// ==========================================================

export interface CreateAuditLogParams {
  action: AuditAction;
  executorId: string;
  targetId?: string | null;
  ticketId?: string | null;
  medalId?: string | null;
  details?: Prisma.InputJsonValue | null;
}

export interface SendAuditLogParams {
  guild: Guild;
  action: AuditAction;
  executorId: string;
  targetId?: string | null;
  ticketId?: string | null;
  medalId?: string | null;
  details?: Prisma.InputJsonValue | null;
}

// ==========================================================
// INFORMAÇÕES VISUAIS DAS AÇÕES
// ==========================================================

const actionLabels: Record<
  AuditAction,
  {
    title: string;
    description: string;
  }
> = {
  // ========================================================
  // TICKETS
  // ========================================================

  TICKET_CREATED: {
    title: "🎫 Ticket criado",
    description:
      "Uma nova solicitação foi registrada no sistema.",
  },

  TICKET_CLOSED: {
    title: "🔒 Ticket encerrado",
    description:
      "O atendimento deste ticket foi encerrado.",
  },

  TICKET_DELETED: {
    title: "🗑️ Ticket excluído",
    description:
      "Um ticket foi removido do sistema.",
  },

  // ========================================================
  // MEDALHAS
  // ========================================================

  MEDAL_CREATED: {
    title: "🏅 Medalha criada",
    description:
      "Uma nova medalha foi cadastrada no Atlas.",
  },

  MEDAL_UPDATED: {
    title: "✏️ Medalha atualizada",
    description:
      "Uma medalha cadastrada no Atlas foi atualizada.",
  },

  MEDAL_REMOVED: {
    title: "🗑️ Medalha removida",
    description:
      "Uma medalha foi removida do sistema.",
  },

  // ========================================================
  // APROVAÇÃO
  // ========================================================

  MEDAL_APPROVED: {
    title: "✅ Medalha aprovada",
    description:
      "A solicitação foi analisada e aprovada.",
  },

  // ========================================================
  // ACEITAÇÃO PARA ENTREGA
  // ========================================================

  MEDAL_ACCEPTED: {
    title: "🪖 Medalha aceita para entrega",
    description:
      "Um membro autorizado assumiu a responsabilidade pela entrega.",
  },

  // ========================================================
  // ENTREGA EFETIVA
  // ========================================================

  MEDAL_GRANTED: {
    title: "🏅 Medalha entregue",
    description:
      "A medalha foi efetivamente entregue ao usuário.",
  },

  // ========================================================
  // NEGATIVA
  // ========================================================

  MEDAL_DENIED: {
    title: "❌ Medalha negada",
    description:
      "A solicitação de medalha foi recusada durante a análise.",
  },

  // ========================================================
  // SEGURANÇA
  // ========================================================

  MEDAL_SELF_DELIVERY_BLOCKED: {
    title: "🚫 Autoentrega bloqueada",
    description:
      "O Atlas impediu uma tentativa de entregar uma medalha ao próprio executor.",
  },

  MEDAL_SELF_DELIVERY_ATTEMPT: {
    title: "🚨 Tentativa de autoentrega",
    description:
      "Um membro da equipe tentou entregar uma medalha para si próprio.",
  },

  // ========================================================
  // TRANSCRIPTS
  // ========================================================

  TRANSCRIPT_CREATED: {
    title: "📄 Transcrição criada",
    description:
      "A transcrição do atendimento foi gerada e armazenada.",
  },

  // ========================================================
  // CONFIGURAÇÃO
  // ========================================================

  CONFIG_UPDATED: {
    title: "⚙️ Configuração atualizada",
    description:
      "As configurações do Atlas foram alteradas.",
  },

  // ========================================================
  // CATEGORIAS
  // ========================================================

  CATEGORY_CREATED: {
    title: "📁 Categoria criada",
    description:
      "Uma nova categoria de medalhas foi cadastrada.",
  },

  CATEGORY_UPDATED: {
    title: "✏️ Categoria atualizada",
    description:
      "Uma categoria de medalhas foi atualizada.",
  },

  CATEGORY_REMOVED: {
    title: "🗑️ Categoria removida",
    description:
      "Uma categoria de medalhas foi removida.",
  },
};

// ==========================================================
// COR DOS LOGS
// ==========================================================

function getActionColor(
  action: AuditAction
): number {
  switch (action) {
    case "MEDAL_APPROVED":
      return 0x2ecc71;

    case "MEDAL_ACCEPTED":
      return 0xe67e22;

    case "MEDAL_GRANTED":
      return 0xf1c40f;

    case "MEDAL_DENIED":
      return 0xe74c3c;

    case "MEDAL_SELF_DELIVERY_BLOCKED":
      return 0xe74c3c;

    case "MEDAL_SELF_DELIVERY_ATTEMPT":
      return 0xc0392b;

    case "TICKET_CLOSED":
    case "TICKET_DELETED":
      return 0x95a5a6;

    case "CONFIG_UPDATED":
      return 0x9b59b6;

    default:
      return 0x3498db;
  }
}

// ==========================================================
// FORMATA VALORES
// ==========================================================

function formatDate(): string {
  return `<t:${Math.floor(Date.now() / 1000)}:F>`;
}

function formatUser(
  userId?: string | null
): string | null {
  if (!userId) {
    return null;
  }

  return `<@${userId}>`;
}

// ==========================================================
// FORMATA TICKET
// ==========================================================

async function formatTicket(
  guild: Guild,
  ticketId?: string | null,
  details?: Prisma.InputJsonValue | null
): Promise<string | null> {
  // ========================================================
  // PRIMEIRO: TENTA OBTER O NÚMERO DOS DETALHES
  // ========================================================

  if (
    details &&
    typeof details === "object" &&
    !Array.isArray(details)
  ) {
    const data =
      details as Record<string, unknown>;

    if (
      typeof data.ticketNumber === "string" &&
      data.ticketNumber.trim()
    ) {
      return `#${data.ticketNumber.replace(/^#/, "")}`;
    }

    if (
      typeof data.ticketNumber === "number"
    ) {
      return `#${data.ticketNumber}`;
    }
  }

  // ========================================================
  // SEGUNDO: BUSCA O TICKET NO BANCO
  // ========================================================

  if (!ticketId) {
    return null;
  }

  try {
    const ticket =
      await prisma.ticket.findUnique({
        where: {
          id: ticketId,
        },
        select: {
          channelId: true,
        },
      });

    if (ticket?.channelId) {
      // ----------------------------------------------------
      // BUSCA O CANAL PARA OBTER O NÚMERO PELO NOME
      // ----------------------------------------------------

      try {
        const channel =
          await guild.channels.fetch(
            ticket.channelId
          );

        if (
          channel &&
          "name" in channel &&
          typeof channel.name === "string"
        ) {
          const match =
            channel.name.match(/(\d+)$/);

          if (match) {
            return `#${match[1]}`;
          }
        }
      } catch {
        // O canal pode ter sido excluído.
      }
    }
  } catch (error) {
    console.warn(
      "⚠️ [AUDIT LOG] Não foi possível recuperar o ticket para exibição:",
      error
    );
  }

  return "Ticket";
}

// ==========================================================
// FORMATA MEDALHA
// ==========================================================

function formatMedal(
  medalId?: string | null,
  details?: Prisma.InputJsonValue | null
): string | null {
  if (
    details &&
    typeof details === "object" &&
    !Array.isArray(details)
  ) {
    const data =
      details as Record<string, unknown>;

    if (
      typeof data.name === "string" &&
      data.name.trim()
    ) {
      return `**${data.name}**`;
    }

    if (
      typeof data.medalName === "string" &&
      data.medalName.trim()
    ) {
      return `**${data.medalName}**`;
    }
  }

  if (!medalId) {
    return null;
  }

  return "Medalha";
}

// ==========================================================
// DETALHES VISUAIS
// ==========================================================

function buildDetailsSection(
  action: AuditAction,
  details?: Prisma.InputJsonValue | null
): string | null {
  if (
    details === undefined ||
    details === null ||
    typeof details !== "object" ||
    Array.isArray(details)
  ) {
    return null;
  }

  const data =
    details as Record<string, unknown>;

  const lines: string[] = [];

  // ========================================================
  // TICKET
  // ========================================================

  if (
    action === "TICKET_CREATED" ||
    action === "TICKET_CLOSED" ||
    action === "TICKET_DELETED"
  ) {
    if (
      typeof data.ticketNumber === "string" &&
      data.ticketNumber.trim()
    ) {
      lines.push(
        `🎫 **Canal:** #${data.ticketNumber.replace(/^#/, "")}`
      );
    } else if (
      typeof data.ticketNumber === "number"
    ) {
      lines.push(
        `🎫 **Canal:** #${data.ticketNumber}`
      );
    } else if (
      typeof data.ticketChannelName === "string"
    ) {
      const match =
        data.ticketChannelName.match(/(\d+)$/);

      if (match) {
        lines.push(
          `🎫 **Canal:** #${match[1]}`
        );
      }
    }

    if (
      typeof data.reason === "string" &&
      data.reason.trim()
    ) {
      lines.push(
        `📝 **Motivo:** ${data.reason}`
      );
    }
  }

  // ========================================================
  // TRANSCRIÇÃO
  // ========================================================

  if (
    action === "TRANSCRIPT_CREATED"
  ) {
    if (
      typeof data.url === "string"
    ) {
      lines.push(
        `📄 **Transcrição:** [Visualizar transcrição](${data.url})`
      );
    }

    if (
      typeof data.transcriptChannelId === "string"
    ) {
      lines.push(
        `📁 **Armazenada em:** <#${data.transcriptChannelId}>`
      );
    }
  }

  // ========================================================
  // MEDALHA
  // ========================================================

  if (
    action === "MEDAL_CREATED" ||
    action === "MEDAL_UPDATED" ||
    action === "MEDAL_REMOVED"
  ) {
    if (
      typeof data.name === "string"
    ) {
      lines.push(
        `🏅 **Medalha:** ${data.name}`
      );
    }

    if (
      typeof data.categoryName === "string"
    ) {
      lines.push(
        `🗂️ **Categoria:** ${data.categoryName}`
      );
    }

    if (
      typeof data.deliveryGuildName === "string"
    ) {
      lines.push(
        `🏰 **Servidor de entrega:** ${data.deliveryGuildName}`
      );
    }
  }

  // ========================================================
  // APROVAÇÃO / NEGAÇÃO
  // ========================================================

  if (
    action === "MEDAL_APPROVED" ||
    action === "MEDAL_DENIED"
  ) {
    if (
      typeof data.reason === "string" &&
      data.reason.trim()
    ) {
      lines.push(
        `📝 **Justificativa:** ${data.reason}`
      );
    }

    if (
      typeof data.medalName === "string"
    ) {
      lines.push(
        `🏅 **Medalha:** ${data.medalName}`
      );
    }

    if (
      typeof data.categoryName === "string"
    ) {
      lines.push(
        `🗂️ **Categoria:** ${data.categoryName}`
      );
    }
  }

  // ========================================================
  // ACEITAÇÃO
  // ========================================================

  if (
    action === "MEDAL_ACCEPTED"
  ) {
    if (
      typeof data.medalName === "string"
    ) {
      lines.push(
        `🏅 **Medalha:** ${data.medalName}`
      );
    }

    if (
      typeof data.deliveryRoleName === "string"
    ) {
      lines.push(
        `🪖 **Responsável pela entrega:** ${data.deliveryRoleName}`
      );
    }
  }

  // ========================================================
  // ENTREGA
  // ========================================================

  if (
    action === "MEDAL_GRANTED"
  ) {
    if (
      typeof data.medalName === "string"
    ) {
      lines.push(
        `🏅 **Medalha:** ${data.medalName}`
      );
    }

    if (
      typeof data.deliveryGuildName === "string"
    ) {
      lines.push(
        `🏰 **Servidor:** ${data.deliveryGuildName}`
      );
    }

    if (
      Array.isArray(data.roleNames)
    ) {
      const roleNames =
        data.roleNames.filter(
          (value): value is string =>
            typeof value === "string"
        );

      if (roleNames.length > 0) {
        lines.push(
          `🎖️ **Cargos concedidos:** ${roleNames.join(", ")}`
        );
      }
    }
  }

  // ========================================================
  // AUTOENTREGA
  // ========================================================

  if (
    action === "MEDAL_SELF_DELIVERY_BLOCKED" ||
    action === "MEDAL_SELF_DELIVERY_ATTEMPT"
  ) {
    if (
      typeof data.medalName === "string"
    ) {
      lines.push(
        `🏅 **Medalha:** ${data.medalName}`
      );
    }

    if (
      typeof data.reason === "string" &&
      data.reason.trim()
    ) {
      lines.push(
        `📝 **Motivo:** ${data.reason}`
      );
    }
  }

  // ========================================================
  // CATEGORIA
  // ========================================================

  if (
    action === "CATEGORY_CREATED" ||
    action === "CATEGORY_UPDATED" ||
    action === "CATEGORY_REMOVED"
  ) {
    if (
      typeof data.name === "string"
    ) {
      lines.push(
        `📁 **Categoria:** ${data.name}`
      );
    }

    if (
      typeof data.description === "string" &&
      data.description.trim()
    ) {
      lines.push(
        `📝 **Descrição:** ${data.description}`
      );
    }
  }

  // ========================================================
  // CONFIGURAÇÃO
  // ========================================================

  if (
    action === "CONFIG_UPDATED"
  ) {
    if (
      typeof data.field === "string"
    ) {
      lines.push(
        `⚙️ **Configuração:** ${data.field}`
      );
    }

    if (
      typeof data.description === "string"
    ) {
      lines.push(
        `📝 **Alteração:** ${data.description}`
      );
    }
  }

  // ========================================================
  // FALLBACK
  // ========================================================

  if (lines.length === 0) {
    const simpleEntries =
      Object.entries(data)
        .filter(
          ([, value]) =>
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
        )
        .slice(0, 10);

    for (
      const [key, value]
      of simpleEntries
    ) {
      const formattedKey =
        key
          .replace(
            /([A-Z])/g,
            " $1"
          )
          .replace(
            /^./,
            (char) =>
              char.toUpperCase()
          );

      lines.push(
        `• **${formattedKey}:** ${String(value)}`
      );
    }
  }

  if (lines.length === 0) {
    return null;
  }

  return [
    "## 🔎 Informações",
    "",
    ...lines,
  ].join("\n");
}

// ==========================================================
// CRIAR AUDIT LOG
// ==========================================================

export async function createAuditLog(
  params: CreateAuditLogParams
) {
  const {
    action,
    executorId,
    targetId,
    ticketId,
    medalId,
    details,
  } = params;

  return prisma.auditLog.create({
    data: {
      action,
      executorId,

      ...(targetId !== undefined
        ? {
            targetId,
          }
        : {}),

      ...(ticketId !== undefined
        ? {
            ticketId,
          }
        : {}),

      ...(medalId !== undefined
        ? {
            medalId,
          }
        : {}),

      ...(details !== undefined
        ? {
            details:
              details ??
              Prisma.JsonNull,
          }
        : {}),
    },
  });
}

// ==========================================================
// ENVIO DO LOG PARA O DISCORD
// ==========================================================

export async function sendAuditLog(
  params: SendAuditLogParams
): Promise<void> {
  const {
    guild,
    action,
    executorId,
    targetId,
    ticketId,
    medalId,
    details,
  } = params;

  // ========================================================
  // BUSCA CONFIGURAÇÃO
  // ========================================================

  const config =
    await prisma.guildConfig.findUnique({
      where: {
        requestGuildId: guild.id,
      },
    });

  if (!config?.logChannelId) {
    console.warn(
      "⚠️ [AUDIT LOG] Canal de logs não configurado."
    );

    return;
  }

  // ========================================================
  // BUSCA CANAL
  // ========================================================

  const channel =
    await guild.channels.fetch(
      config.logChannelId
    );

  if (
    !channel ||
    !channel.isTextBased()
  ) {
    console.warn(
      "⚠️ [AUDIT LOG] Canal de logs não encontrado ou não é textual."
    );

    return;
  }

  if (!channel.isSendable()) {
    console.warn(
      "⚠️ [AUDIT LOG] Atlas não possui permissão para enviar mensagens no canal de logs."
    );

    return;
  }

  // ========================================================
  // INFORMAÇÕES DA AÇÃO
  // ========================================================

  const actionInfo =
    actionLabels[action] ?? {
      title: `📋 ${action}`,
      description:
        "Uma ação foi registrada no sistema.",
    };

  const accentColor =
    getActionColor(action);

  // ========================================================
  // DADOS VISUAIS
  // ========================================================

  const ticketDisplay =
    await formatTicket(
      guild,
      ticketId,
      details
    );

  const medalDisplay =
    formatMedal(
      medalId,
      details
    );

  const detailsSection =
    buildDetailsSection(
      action,
      details
    );

  // ========================================================
  // CONTAINER PRINCIPAL
  // ========================================================

  const container =
    new ContainerBuilder()
      .setAccentColor(
        accentColor
      )

      // ====================================================
      // CABEÇALHO
      // ====================================================

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              `# ${actionInfo.title}`,
              "",
              actionInfo.description,
            ].join("\n")
          )
      )

      // ====================================================
      // SEPARADOR
      // ====================================================

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      // ====================================================
      // EVENTO
      // ====================================================

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              "## 📋 Evento",
              "",
              `🕐 **Data:** ${formatDate()}`,
              `🛡️ **Responsável:** ${formatUser(executorId) ?? "Não informado"}`,
            ].join("\n")
          )
      );

  // ========================================================
  // ENVOLVIDOS
  // ========================================================

  const peopleLines: string[] = [];

  if (targetId) {
    peopleLines.push(
      `👤 **Solicitante:** ${formatUser(targetId)}`
    );
  }

  if (peopleLines.length > 0) {
    container
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              "## 👥 Envolvidos",
              "",
              ...peopleLines,
            ].join("\n")
          )
      );
  }

  // ========================================================
  // CONTEXTO
  // ========================================================

  const contextLines: string[] = [];

  if (ticketDisplay) {
    contextLines.push(
      `🎫 **Ticket:** ${ticketDisplay}`
    );
  }

  if (medalDisplay) {
    contextLines.push(
      `🏅 **Medalha:** ${medalDisplay}`
    );
  }

  if (contextLines.length > 0) {
    container
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              "## 📌 Contexto",
              "",
              ...contextLines,
            ].join("\n")
          )
      );
  }

  // ========================================================
  // DETALHES
  // ========================================================

  if (detailsSection) {
    container
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            detailsSection
          )
      );
  }

  // ========================================================
  // ENVIA LOG
  // ========================================================

  await channel.send({
    components: [
      container,
    ],
    flags:
      MessageFlags.IsComponentsV2,
  });
}

// ==========================================================
// REGISTRA + ENVIA LOG
// ==========================================================

export async function logAuditEvent(
  params: SendAuditLogParams
): Promise<void> {
  const {
    guild,
    action,
    executorId,
    targetId,
    ticketId,
    medalId,
    details,
  } = params;

  // ========================================================
  // MONTA SOMENTE OS CAMPOS DEFINIDOS
  // ========================================================

  const auditParams:
    CreateAuditLogParams = {
      action,
      executorId,
    };

  if (
    targetId !== undefined
  ) {
    auditParams.targetId =
      targetId;
  }

  if (
    ticketId !== undefined
  ) {
    auditParams.ticketId =
      ticketId;
  }

  if (
    medalId !== undefined
  ) {
    auditParams.medalId =
      medalId;
  }

  if (
    details !== undefined
  ) {
    auditParams.details =
      details;
  }

  // ========================================================
  // BANCO DE DADOS
  // ========================================================

  await createAuditLog(
    auditParams
  );

  // ========================================================
  // DISCORD
  // ========================================================

  await sendAuditLog(
    params
  );
}