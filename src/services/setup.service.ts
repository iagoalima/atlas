import { prisma } from "../infrastructure/database/prisma.js";

// ==========================================================
// TIPOS
// ==========================================================

export interface SetupData {
  staffRoleId?: string;

  responsibleRoleId?: string;

  ticketCategoryId?: string;

  logChannelId?: string;

  transcriptChannelId?: string;

  deliveryGuildId?: string;

  medalCatalogChannelId?: string;

  medalCatalogMessageId?: string;

  ticketPanelChannelId?: string;

  ticketPanelMessageId?: string;
}

// ==========================================================
// SESSÕES TEMPORÁRIAS
// ==========================================================

const setupSessions =
  new Map<string, SetupData>();

// ==========================================================
// BUSCA CONFIGURAÇÃO TEMPORÁRIA
// ==========================================================

export function getSetupData(
  guildId: string
): SetupData {
  return (
    setupSessions.get(guildId) ?? {}
  );
}

// ==========================================================
// ATUALIZA CONFIGURAÇÃO TEMPORÁRIA
// ==========================================================

export function updateSetupData(
  guildId: string,
  data: Partial<SetupData>
): SetupData {
  const current =
    getSetupData(guildId);

  const updated: SetupData = {
    ...current,
    ...data,
  };

  setupSessions.set(
    guildId,
    updated
  );

  return updated;
}

// ==========================================================
// CARREGA CONFIGURAÇÃO DO BANCO
// ==========================================================

export async function loadGuildConfig(
  guildId: string
): Promise<SetupData> {
  const config =
    await prisma.guildConfig.findUnique({
      where: {
        requestGuildId:
          guildId,
      },
    });

  if (!config) {
    return {};
  }

  const data: SetupData = {};

  // ========================================================
  // CARGO DA EQUIPE
  // ========================================================

  if (config.staffRoleId) {
    data.staffRoleId =
      config.staffRoleId;
  }

  // ========================================================
  // CARGO DOS RESPONSÁVEIS
  // ========================================================

  if (config.responsibleRoleId) {
    data.responsibleRoleId =
      config.responsibleRoleId;
  }

  // ========================================================
  // CATEGORIA DE TICKETS
  // ========================================================

  if (config.ticketCategoryId) {
    data.ticketCategoryId =
      config.ticketCategoryId;
  }

  // ========================================================
  // CANAL DE LOGS
  // ========================================================

  if (config.logChannelId) {
    data.logChannelId =
      config.logChannelId;
  }

  // ========================================================
  // CANAL DE TRANSCRIPTS
  // ========================================================

  if (config.transcriptChannelId) {
    data.transcriptChannelId =
      config.transcriptChannelId;
  }

  // ========================================================
  // SERVIDOR DE ENTREGA
  // ========================================================

  if (config.deliveryGuildId) {
    data.deliveryGuildId =
      config.deliveryGuildId;
  }

  // ========================================================
  // CATÁLOGO DE MEDALHAS
  // ========================================================

  if (config.medalCatalogChannelId) {
    data.medalCatalogChannelId =
      config.medalCatalogChannelId;
  }

  if (config.medalCatalogMessageId) {
    data.medalCatalogMessageId =
      config.medalCatalogMessageId;
  }

  // ========================================================
  // PAINEL DE TICKETS
  // ========================================================

  if (config.ticketPanelChannelId) {
    data.ticketPanelChannelId =
      config.ticketPanelChannelId;
  }

  if (config.ticketPanelMessageId) {
    data.ticketPanelMessageId =
      config.ticketPanelMessageId;
  }

  // ========================================================
  // SALVA NA SESSÃO
  // ========================================================

  setupSessions.set(
    guildId,
    data
  );

  return data;
}

// ==========================================================
// LIMPA SESSÃO
// ==========================================================

export function clearSetupData(
  guildId: string
): void {
  setupSessions.delete(
    guildId
  );
}

// ==========================================================
// SALVA CONFIGURAÇÃO
// ==========================================================

export async function saveGuildConfig(
  guildId: string,
  data: SetupData
): Promise<void> {
  // ========================================================
  // VALIDA CAMPOS OBRIGATÓRIOS
  // ========================================================

  if (
    !data.staffRoleId ||
    !data.responsibleRoleId ||
    !data.ticketCategoryId ||
    !data.logChannelId ||
    !data.transcriptChannelId ||
    !data.deliveryGuildId
  ) {
    throw new Error(
      "Configuração incompleta."
    );
  }

  // ========================================================
  // SALVA NO BANCO
  // ========================================================

  await prisma.guildConfig.upsert({
    where: {
      requestGuildId:
        guildId,
    },

    update: {
  staffRoleId:
    data.staffRoleId,
  responsibleRoleId:
    data.responsibleRoleId,
  ticketCategoryId:
    data.ticketCategoryId,
  logChannelId:
    data.logChannelId,
  transcriptChannelId:
    data.transcriptChannelId,
  deliveryGuildId:
    data.deliveryGuildId,

  medalCatalogChannelId:
    data.medalCatalogChannelId ??
    null,

  ticketPanelChannelId:
    data.ticketPanelChannelId ??
    null,
},

    create: {
  requestGuildId:
    guildId,
  staffRoleId:
    data.staffRoleId,
  responsibleRoleId:
    data.responsibleRoleId,
  ticketCategoryId:
    data.ticketCategoryId,
  logChannelId:
    data.logChannelId,
  transcriptChannelId:
    data.transcriptChannelId,
  deliveryGuildId:
    data.deliveryGuildId,

  medalCatalogChannelId:
    data.medalCatalogChannelId ??
    null,

  ticketPanelChannelId:
    data.ticketPanelChannelId ??
    null,
},
  });

  // ========================================================
  // LIMPA SESSÃO
  // ========================================================

  clearSetupData(
    guildId
  );
}