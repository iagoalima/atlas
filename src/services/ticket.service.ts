import {
  ChannelType,
  Guild,
  PermissionFlagsBits,
} from "discord.js";

import {
  logAuditEvent,
} from "./audit-log.service.js";

import { prisma } from "../infrastructure/database/prisma.js";

// ==========================================================
// TIPOS
// ==========================================================

export interface CreateTicketParams {
  guild: Guild;
  channelId?: string;

  userId: string;
  username: string;
  nickname: string | null;

  robloxUsername: string;

  reason?: string | null;

  medalIds: string[];
}

// ==========================================================
// STATUS DE PROCESSAMENTO
// ==========================================================

export interface TicketMedalProgress {
  total: number;
  pending: number;
  approved: number;
  denied: number;
  granted: number;
  processed: number;
  allProcessed: boolean;
}

// ==========================================================
// CRIAÇÃO DE TICKET
// ==========================================================

export async function createTicket(
  params: CreateTicketParams
) {
  const {
    guild,
    userId,
    username,
    nickname,
    robloxUsername,
    reason,
    medalIds,
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

  if (!config) {
    throw new Error(
      "O sistema de tickets não está configurado neste servidor."
    );
  }

  if (!config.ticketCategoryId) {
    throw new Error(
      "A categoria dos tickets não está configurada."
    );
  }

  if (!config.staffRoleId) {
    throw new Error(
      "O cargo da equipe de medalhas não está configurado."
    );
  }

  if (!config.responsibleRoleId) {
    throw new Error(
      "O cargo dos responsáveis do setor não está configurado."
    );
  }

  // ========================================================
  // VERIFICA TICKET EXISTENTE
  // ========================================================

  const existingTicket =
    await prisma.ticket.findFirst({
      where: {
        userId,
        status: "OPEN",
      },
    });

  if (existingTicket) {
    const existingChannel =
      guild.channels.cache.get(
        existingTicket.channelId
      );

    if (existingChannel) {
      throw new Error(
        `Você já possui um ticket aberto: ${existingChannel.id}`
      );
    }

    await prisma.ticket.update({
      where: {
        id: existingTicket.id,
      },

      data: {
        status: "CLOSED",
        closedAt: new Date(),
      },
    });
  }

  // ========================================================
  // VALIDA MEDALHAS
  // ========================================================

  const uniqueMedalIds =
    [...new Set(medalIds)];

  if (
    uniqueMedalIds.length < 1 ||
    uniqueMedalIds.length > 3
  ) {
    throw new Error(
      "A solicitação deve conter entre 1 e 3 medalhas."
    );
  }

  const medals =
    await prisma.medal.findMany({
      where: {
        id: {
          in: uniqueMedalIds,
        },

        active: true,
      },

      include: {
        category: true,
      },
    });

  if (
    medals.length !==
    uniqueMedalIds.length
  ) {
    throw new Error(
      "Uma ou mais medalhas selecionadas não estão mais disponíveis."
    );
  }

  // ========================================================
  // NOME DO CANAL
  // ========================================================

  const safeUsername =
    username
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20);

  const channelName =
    `ticket-${safeUsername || userId}`;

  // ========================================================
  // CRIA CANAL
  // ========================================================

  const channel =
    await guild.channels.create({
      name: channelName,

      type: ChannelType.GuildText,

      parent:
        config.ticketCategoryId,

      topic:
        `Solicitação de medalhas • Roblox: ${robloxUsername}`,

      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,

          deny: [
            PermissionFlagsBits.ViewChannel,
          ],
        },

        {
          id: userId,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },

        {
          id: config.staffRoleId,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },

        {
          id: config.responsibleRoleId,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },

      ],
    });

  // ========================================================
  // CRIA TICKET NO BANCO
  // ========================================================

  let ticketId: string | null = null;

  try {
    const ticket =
      await prisma.ticket.create({
        data: {
          channelId: channel.id,

          userId,

          username,

          nickname,

          robloxUsername,

          status: "OPEN",

          reason:
            reason ?? null,

          medals: {
            create:
              uniqueMedalIds.map(
                (medalId) => ({
                  medalId,

                  status: "PENDING",
                })
              ),
          },
        },

        include: {
          medals: {
            include: {
              medal: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
      });

    ticketId =
      ticket.id;

    // ======================================================
    // REGISTRA AUDITORIA
    // ======================================================

    await logAuditEvent({
      guild,

      action:
        "TICKET_CREATED",

      executorId:
        userId,

      targetId:
        userId,

      ticketId:
        ticket.id,

      details: {
        ticketNumber:
          ticket.ticketNumber,

        username,

        nickname,

        robloxUsername,

        reason:
          reason ?? null,

        medalIds:
          uniqueMedalIds,

        medalNames:
          medals.map(
            (medal) =>
              medal.name
          ),
      },
    });

    console.log(
      "📝 [TICKET] Auditoria de criação registrada:",
      {
        ticketId:
          ticket.id,

        ticketNumber:
          ticket.ticketNumber,

        userId,
      }
    );

    return {
      ticket,
      channel,
      medals,
    };
  } catch (error) {
    // ======================================================
    // LIMPA CANAL CASO O BANCO FALHE
    // ======================================================

    try {
      await channel.delete(
        "Falha durante a criação do ticket no banco de dados."
      );
    } catch (cleanupError) {
      console.error(
        "❌ [TICKET SERVICE] Erro ao remover canal após falha:",
        cleanupError
      );
    }

    console.error(
      "❌ [TICKET SERVICE] Erro ao criar ticket:",
      {
        error,

        ticketId,

        userId,

        robloxUsername,

        medalIds:
          uniqueMedalIds,
      }
    );

    throw error;
  }
}

// ==========================================================
// BUSCAR TICKET PELO CANAL
// ==========================================================

export async function getTicketByChannelId(
  channelId: string
) {
  return prisma.ticket.findFirst({
    where: {
      channelId,
    },

    include: {
      medals: {
        include: {
          medal: {
            include: {
              category: true,
            },
          },
        },
      },

      logs: true,

      transcript: true,

      forceCloseApprovals: true,
    },
  });
}

// ==========================================================
// BUSCAR TICKET PELO ID
// ==========================================================

export async function getTicketById(
  ticketId: string
) {
  return prisma.ticket.findUnique({
    where: {
      id: ticketId,
    },

    include: {
      medals: {
        include: {
          medal: {
            include: {
              category: true,
            },
          },
        },
      },

      logs: true,

      transcript: true,

      forceCloseApprovals: true,
    },
  });
}

// ==========================================================
// BUSCAR TICKET ABERTO DO USUÁRIO
// ==========================================================

export async function getOpenTicketByUserId(
  userId: string
) {
  return prisma.ticket.findFirst({
    where: {
      userId,

      status: "OPEN",
    },

    include: {
      medals: {
        include: {
          medal: {
            include: {
              category: true,
            },
          },
        },
      },
    },
  });
}

// ==========================================================
// FECHAR TICKET
// ==========================================================

export async function closeTicket(
  ticketId: string
) {
  return prisma.ticket.update({
    where: {
      id: ticketId,
    },

    data: {
      status: "CLOSED",

      closedAt:
        new Date(),
    },
  });
}

// ==========================================================
// ATUALIZAR NOME DO ROBLOX
// ==========================================================

export async function updateTicketRobloxUsername(
  ticketId: string,
  robloxUsername: string
) {
  return prisma.ticket.update({
    where: {
      id: ticketId,
    },

    data: {
      robloxUsername,
    },
  });
}

// ==========================================================
// ATUALIZAR MOTIVO
// ==========================================================

export async function updateTicketReason(
  ticketId: string,
  reason: string | null
) {
  return prisma.ticket.update({
    where: {
      id: ticketId,
    },

    data: {
      reason,
    },
  });
}

// ==========================================================
// BUSCAR PROGRESSO DAS MEDALHAS
// ==========================================================

export async function getTicketMedalProgress(
  ticketId: string
): Promise<TicketMedalProgress> {
  const medals =
    await prisma.ticketMedal.findMany({
      where: {
        ticketId,
      },

      select: {
        status: true,
      },
    });

  const total =
    medals.length;

  const pending =
    medals.filter(
      (medal) =>
        medal.status === "PENDING"
    ).length;

  const approved =
    medals.filter(
      (medal) =>
        medal.status === "APPROVED"
    ).length;

  const denied =
    medals.filter(
      (medal) =>
        medal.status === "DENIED"
    ).length;

  const granted =
    medals.filter(
      (medal) =>
        medal.status === "GRANTED"
    ).length;

  const processed =
    denied + granted;

  const allProcessed =
    total > 0 &&
    pending === 0 &&
    approved === 0;

  return {
    total,
    pending,
    approved,
    denied,
    granted,
    processed,
    allProcessed,
  };
}

// ==========================================================
// VERIFICA MEDALHAS PENDENTES
// ==========================================================

export async function hasPendingMedals(
  ticketId: string
): Promise<boolean> {
  const pending =
    await prisma.ticketMedal.count({
      where: {
        ticketId,

        status: "PENDING",
      },
    });

  return pending > 0;
}

// ==========================================================
// VERIFICA MEDALHAS APROVADAS
// ==========================================================

export async function hasApprovedMedals(
  ticketId: string
): Promise<boolean> {
  const approved =
    await prisma.ticketMedal.count({
      where: {
        ticketId,

        status: "APPROVED",
      },
    });

  return approved > 0;
}

// ==========================================================
// VERIFICA SE TODAS AS MEDALHAS FORAM PROCESSADAS
// ==========================================================

export async function areAllMedalsProcessed(
  ticketId: string
): Promise<boolean> {
  const progress =
    await getTicketMedalProgress(
      ticketId
    );

  return progress.allProcessed;
}