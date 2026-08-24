import {
  Client,
  Guild,
  GuildMember,
  Role,
} from "discord.js";

import { prisma } from "../infrastructure/database/prisma.js";

import {
  getMedalRoles,
} from "./medal-role.service.js";

import {
  logAuditEvent,
} from "./audit-log.service.js";

// ==========================================================
// TIPOS
// ==========================================================

export interface DeliverMedalParams {
  client: Client;
  ticketMedalId: string;
  executorId: string;
  requestGuildId: string;
}

export interface DeliverMedalResult {
  guild: Guild;
  member: GuildMember;

  addedRoleIds: string[];
  addedRoleNames: string[];

  alreadyHadRoleIds: string[];
  alreadyHadRoleNames: string[];
}

// ==========================================================
// ENTREGA DE MEDALHA
// ==========================================================

export async function deliverMedal(
  params: DeliverMedalParams
): Promise<DeliverMedalResult> {
  const {
    client,
    ticketMedalId,
    executorId,
    requestGuildId,
  } = params;

  // ========================================================
  // BUSCA TICKET MEDAL
  // ========================================================

  const ticketMedal =
    await prisma.ticketMedal.findUnique({
      where: {
        id: ticketMedalId,
      },

      include: {
        ticket: true,

        medal: {
          include: {
            category: true,

            deliveryPermissionRoles: true,
          },
        },
      },
    });

  if (!ticketMedal) {
    throw new Error(
      "Solicitação de medalha não encontrada."
    );
  }

  // ========================================================
  // VERIFICA STATUS
  // ========================================================

  if (
    ticketMedal.status ===
    "GRANTED"
  ) {
    throw new Error(
      "Esta medalha já foi entregue."
    );
  }

  if (
    ticketMedal.status !==
    "APPROVED"
  ) {
    throw new Error(
      `A medalha não pode ser entregue porque seu status atual é ${ticketMedal.status}.`
    );
  }

  // ========================================================
  // BLOQUEIA AUTOENTREGA
  // ========================================================

  if (
    executorId ===
    ticketMedal.ticket.userId
  ) {
    try {
      const requestGuild =
        await client.guilds.fetch(
          requestGuildId
        );

      await logAuditEvent({
        guild:
          requestGuild,

        action:
          "MEDAL_SELF_DELIVERY_ATTEMPT",

        executorId,

        targetId:
          ticketMedal.ticket.userId,

        ticketId:
          ticketMedal.ticket.id,

        medalId:
          ticketMedal.medalId,

        details: {
          medalName:
            ticketMedal.medal.name,

          reason:
            "O executor tentou entregar a medalha para si próprio.",

          blocked: true,
        },
      });
    } catch (logError) {
      console.error(
        "❌ [MEDAL DELIVERY] Erro ao registrar tentativa de autoentrega:",
        logError
      );
    }

    throw new Error(
      "Você não pode entregar uma medalha para si mesmo."
    );
  }

  // ========================================================
  // BUSCA CONFIGURAÇÃO
  // ========================================================

  const config =
    await prisma.guildConfig.findUnique({
      where: {
        requestGuildId,
      },
    });

  if (!config) {
    throw new Error(
      "Configuração do Atlas não encontrada."
    );
  }

  // ========================================================
  // SERVIDOR DE ENTREGA
  // ========================================================

  if (!config.deliveryGuildId) {
    throw new Error(
      "O servidor de entrega de medalhas ainda não foi configurado."
    );
  }

  // ========================================================
  // BUSCA SERVIDOR DE SOLICITAÇÃO
  // ========================================================

  const requestGuild =
    await client.guilds.fetch(
      requestGuildId
    );

  // ========================================================
  // VERIFICA PERMISSÃO ESPECÍFICA DE ENTREGA
  // ========================================================

  const executor =
    await requestGuild.members.fetch(
      executorId
    );

  const deliveryPermissionRoles =
    ticketMedal.medal
      .deliveryPermissionRoles;

  if (
    deliveryPermissionRoles.length ===
    0
  ) {
    throw new Error(
      `A medalha "${ticketMedal.medal.name}" não possui cargos autorizados a realizar a entrega.`
    );
  }

  const hasDeliveryPermission =
    deliveryPermissionRoles.some(
      (permissionRole) =>
        executor.roles.cache.has(
          permissionRole.roleId
        )
    );

  if (
    !hasDeliveryPermission
  ) {
    try {
      await logAuditEvent({
        guild:
          requestGuild,

        action:
          "MEDAL_SELF_DELIVERY_BLOCKED",

        executorId,

        targetId:
          ticketMedal.ticket.userId,

        ticketId:
          ticketMedal.ticket.id,

        medalId:
          ticketMedal.medalId,

        details: {
          medalName:
            ticketMedal.medal.name,

          reason:
            "O executor não possui um cargo autorizado a entregar esta medalha.",

          requiredRoleIds:
            deliveryPermissionRoles.map(
              (role) =>
                role.roleId
            ),

          blocked: true,
        },
      });
    } catch (logError) {
      console.error(
        "❌ [MEDAL DELIVERY] Erro ao registrar tentativa sem permissão:",
        logError
      );
    }

    throw new Error(
      `Você não possui permissão para entregar a medalha "${ticketMedal.medal.name}".`
    );
  }

  // ========================================================
  // SERVIDOR DE ENTREGA
  // ========================================================

  const deliveryGuild =
    await client.guilds.fetch(
      config.deliveryGuildId
    );

  // ========================================================
  // BUSCA MEMBRO
  // ========================================================

  let member: GuildMember;

  try {
    member =
      await deliveryGuild.members.fetch(
        ticketMedal.ticket.userId
      );
  } catch {
    throw new Error(
      "O usuário não foi encontrado no servidor de entrega de medalhas."
    );
  }

  // ========================================================
  // BUSCA CARGOS DA MEDALHA
  // ========================================================

  const medalRoles =
    await getMedalRoles(
      ticketMedal.medalId
    );

  if (
    medalRoles.length ===
    0
  ) {
    throw new Error(
      `A medalha "${ticketMedal.medal.name}" não possui cargos de entrega configurados.`
    );
  }

  // ========================================================
  // BUSCA CARGOS NO SERVIDOR
  // ========================================================

  const roles: Role[] = [];

  for (
    const medalRole of medalRoles
  ) {
    const role =
      deliveryGuild.roles.cache.get(
        medalRole.roleId
      );

    if (!role) {
      throw new Error(
        `O cargo ${medalRole.roleId} vinculado à medalha "${ticketMedal.medal.name}" não existe no servidor de entrega.`
      );
    }

    roles.push(role);
  }

  // ========================================================
  // VERIFICA HIERARQUIA DO ATLAS
  // ========================================================

  const botMember =
    deliveryGuild.members.me;

  if (!botMember) {
    throw new Error(
      "Não foi possível identificar o Atlas como membro do servidor de entrega."
    );
  }

  for (
    const role of roles
  ) {
    if (role.managed) {
      throw new Error(
        `O cargo "${role.name}" é gerenciado pelo Discord e não pode ser atribuído manualmente.`
      );
    }

    if (
      role.position >=
      botMember.roles.highest.position
    ) {
      throw new Error(
        `O Atlas não possui hierarquia suficiente para entregar o cargo "${role.name}".`
      );
    }
  }

  // ========================================================
  // SEPARA CARGOS
  // ========================================================

  const rolesToAdd =
    roles.filter(
      (role) =>
        !member.roles.cache.has(
          role.id
        )
    );

  const alreadyHadRoles =
    roles.filter(
      (role) =>
        member.roles.cache.has(
          role.id
        )
    );

  // ========================================================
  // PROTEÇÃO CONTRA ENTREGA DUPLA
  // ========================================================

  const currentTicketMedal =
    await prisma.ticketMedal.findUnique({
      where: {
        id:
          ticketMedal.id,
      },

      select: {
        id: true,
        status: true,
      },
    });

  if (!currentTicketMedal) {
    throw new Error(
      "A solicitação de medalha não existe mais."
    );
  }

  if (
    currentTicketMedal.status ===
    "GRANTED"
  ) {
    throw new Error(
      "Esta medalha já foi entregue."
    );
  }

  if (
    currentTicketMedal.status !==
    "APPROVED"
  ) {
    throw new Error(
      "A medalha não está mais disponível para entrega."
    );
  }

  // ========================================================
  // ENTREGA DOS CARGOS
  // ========================================================

  const addedRoles: Role[] = [];

  try {
    for (
      const role of rolesToAdd
    ) {
      await member.fetch();

      if (
        member.roles.cache.has(
          role.id
        )
      ) {
        continue;
      }

      await member.roles.add(
        role,
        `Medalha ${ticketMedal.medal.name} • Ticket #${ticketMedal.ticket.ticketNumber}`
      );

      addedRoles.push(role);
    }
  } catch (error) {
    console.error(
      "❌ [MEDAL DELIVERY] Erro ao adicionar cargo:",
      {
        ticketMedalId:
          ticketMedal.id,

        ticketId:
          ticketMedal.ticket.id,

        medalId:
          ticketMedal.medalId,

        executorId,

        error,
      }
    );

    // ======================================================
    // ROLLBACK
    // ======================================================

    for (
      const role of addedRoles
    ) {
      try {
        await member.roles.remove(
          role,
          `Rollback da entrega da medalha ${ticketMedal.medal.name}`
        );
      } catch (rollbackError) {
        console.error(
          "❌ [MEDAL DELIVERY] Erro durante rollback:",
          {
            roleId:
              role.id,

            roleName:
              role.name,

            rollbackError,
          }
        );
      }
    }

    throw new Error(
      "Não foi possível concluir a entrega dos cargos da medalha."
    );
  }

  // ========================================================
  // CONFIRMA ESTADO DOS CARGOS
  // ========================================================

  try {
    await member.fetch();
  } catch (error) {
    console.error(
      "❌ [MEDAL DELIVERY] Não foi possível atualizar os dados do membro após a entrega:",
      error
    );

    // ======================================================
    // ROLLBACK
    // ======================================================

    for (
      const role of addedRoles
    ) {
      try {
        await member.roles.remove(
          role,
          `Rollback da entrega da medalha ${ticketMedal.medal.name}`
        );
      } catch (rollbackError) {
        console.error(
          "❌ [MEDAL DELIVERY] Erro durante rollback:",
          rollbackError
        );
      }
    }

    throw new Error(
      "Não foi possível confirmar a entrega dos cargos."
    );
  }

  const missingRoles =
    roles.filter(
      (role) =>
        !member.roles.cache.has(
          role.id
        )
    );

  if (
    missingRoles.length > 0
  ) {
    console.error(
      "❌ [MEDAL DELIVERY] A entrega não pôde ser confirmada:",
      {
        ticketMedalId:
          ticketMedal.id,

        missingRoles:
          missingRoles.map(
            (role) =>
              role.name
          ),
      }
    );

    // ======================================================
    // ROLLBACK
    // ======================================================

    for (
      const role of addedRoles
    ) {
      try {
        await member.roles.remove(
          role,
          `Rollback da entrega incompleta da medalha ${ticketMedal.medal.name}`
        );
      } catch (rollbackError) {
        console.error(
          "❌ [MEDAL DELIVERY] Erro durante rollback:",
          rollbackError
        );
      }
    }

    throw new Error(
      "A entrega dos cargos não pôde ser confirmada."
    );
  }

  // ========================================================
  // ALTERA APPROVED → GRANTED
  // ========================================================

  const granted =
    await prisma.ticketMedal.updateMany({
      where: {
        id:
          ticketMedal.id,

        status:
          "APPROVED",
      },

      data: {
        status:
          "GRANTED",
      },
    });

  if (
    granted.count !==
    1
  ) {
    console.warn(
      "⚠️ [MEDAL DELIVERY] A medalha não pôde ser marcada como GRANTED porque seu estado mudou durante a entrega.",
      {
        ticketMedalId:
          ticketMedal.id,

        updatedCount:
          granted.count,
      }
    );

    const latest =
      await prisma.ticketMedal.findUnique({
        where: {
          id:
            ticketMedal.id,
        },

        select: {
          status: true,
        },
      });

    if (
      latest?.status ===
      "GRANTED"
    ) {
      throw new Error(
        "Esta medalha acabou de ser entregue por outro membro da equipe."
      );
    }

    throw new Error(
      "Não foi possível confirmar a entrega da medalha no banco de dados."
    );
  }

  // ========================================================
  // AUDITORIA — ENTREGA EFETIVA
  // ========================================================

  try {
    await logAuditEvent({
      guild:
        requestGuild,

      action:
        "MEDAL_GRANTED",

      executorId,

      targetId:
        ticketMedal.ticket.userId,

      ticketId:
        ticketMedal.ticket.id,

      medalId:
        ticketMedal.medalId,

      details: {
        medalName:
          ticketMedal.medal.name,

        deliveryGuildId:
          deliveryGuild.id,

        deliveryGuildName:
          deliveryGuild.name,

        addedRoleIds:
          addedRoles.map(
            (role) =>
              role.id
          ),

        addedRoleNames:
          addedRoles.map(
            (role) =>
              role.name
          ),

        alreadyHadRoleIds:
          alreadyHadRoles.map(
            (role) =>
              role.id
          ),

        alreadyHadRoleNames:
          alreadyHadRoles.map(
            (role) =>
              role.name
          ),

        deliveryPermissionRoleIds:
          deliveryPermissionRoles.map(
            (role) =>
              role.roleId
          ),
      },
    });
  } catch (auditError) {
    console.error(
      "❌ [MEDAL DELIVERY] Entrega concluída, mas houve falha ao registrar o MEDAL_GRANTED:",
      {
        ticketMedalId:
          ticketMedal.id,

        ticketId:
          ticketMedal.ticket.id,

        medalId:
          ticketMedal.medalId,

        auditError,
      }
    );
  }

  // ========================================================
  // LOG LOCAL
  // ========================================================

  console.log(
    "🏅 [MEDAL DELIVERY] Medalha entregue com sucesso:",
    {
      ticketMedalId:
        ticketMedal.id,

      ticketId:
        ticketMedal.ticket.id,

      ticketNumber:
        ticketMedal.ticket.ticketNumber,

      medalId:
        ticketMedal.medalId,

      medalName:
        ticketMedal.medal.name,

      userId:
        ticketMedal.ticket.userId,

      executorId,

      deliveryGuildId:
        deliveryGuild.id,

      addedRoles:
        addedRoles.map(
          (role) =>
            role.name
        ),

      alreadyHadRoles:
        alreadyHadRoles.map(
          (role) =>
            role.name
        ),
    }
  );

  // ========================================================
  // RETORNO
  // ========================================================

  return {
    guild:
      deliveryGuild,

    member,

    addedRoleIds:
      addedRoles.map(
        (role) =>
          role.id
      ),

    addedRoleNames:
      addedRoles.map(
        (role) =>
          role.name
      ),

    alreadyHadRoleIds:
      alreadyHadRoles.map(
        (role) =>
          role.id
      ),

    alreadyHadRoleNames:
      alreadyHadRoles.map(
        (role) =>
          role.name
      ),
  };
}