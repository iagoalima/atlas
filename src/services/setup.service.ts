import { prisma } from "../infrastructure/database/prisma.js";

export interface SetupData {
  staffRoleId?: string;
  responsibleRoleId?: string;
  logChannelId?: string;
  deliveryGuildId?: string;
  medalCatalogChannelId?: string;
  medalCatalogMessageId?: string;
  requestPanelChannelId?: string;
  requestPanelMessageId?: string;
  requestReviewChannelId?: string;
  requestsOpen?: boolean;

  // Campos antigos mantidos somente para compatibilidade com instalações anteriores.
  ticketCategoryId?: string;
  transcriptChannelId?: string;
  ticketPanelChannelId?: string;
  ticketPanelMessageId?: string;
}

const setupSessions = new Map<string, SetupData>();

export function getSetupData(guildId: string): SetupData {
  return setupSessions.get(guildId) ?? {};
}

export function updateSetupData(guildId: string, data: Partial<SetupData>): SetupData {
  const updated = { ...getSetupData(guildId), ...data };
  setupSessions.set(guildId, updated);
  return updated;
}

export async function loadGuildConfig(guildId: string): Promise<SetupData> {
  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: guildId } });
  if (!config) return {};

  const data: SetupData = {
    staffRoleId: config.staffRoleId || undefined,
    responsibleRoleId: config.responsibleRoleId || undefined,
    logChannelId: config.logChannelId || undefined,
    deliveryGuildId: config.deliveryGuildId || undefined,
    medalCatalogChannelId: config.medalCatalogChannelId || undefined,
    medalCatalogMessageId: config.medalCatalogMessageId || undefined,
    requestPanelChannelId: config.requestPanelChannelId || undefined,
    requestPanelMessageId: config.requestPanelMessageId || undefined,
    requestReviewChannelId: config.requestReviewChannelId || undefined,
    requestsOpen: config.requestsOpen,
    ticketCategoryId: config.ticketCategoryId || undefined,
    transcriptChannelId: config.transcriptChannelId || undefined,
    ticketPanelChannelId: config.ticketPanelChannelId || undefined,
    ticketPanelMessageId: config.ticketPanelMessageId || undefined,
  };

  setupSessions.set(guildId, data);
  return data;
}

export function clearSetupData(guildId: string): void {
  setupSessions.delete(guildId);
}

export async function saveGuildConfig(guildId: string, data: SetupData): Promise<void> {
  if (!data.staffRoleId || !data.logChannelId || !data.medalCatalogChannelId || !data.requestPanelChannelId || !data.requestReviewChannelId) {
    throw new Error("Configuração incompleta.");
  }

  const existing = await prisma.guildConfig.findUnique({ where: { requestGuildId: guildId } });

  const compatibilityTicketCategoryId = data.ticketCategoryId ?? existing?.ticketCategoryId ?? "UNUSED";
  const compatibilityTranscriptChannelId = data.transcriptChannelId ?? existing?.transcriptChannelId ?? "UNUSED";

  await prisma.guildConfig.upsert({
    where: { requestGuildId: guildId },
    update: {
      staffRoleId: data.staffRoleId,
      responsibleRoleId: data.responsibleRoleId ?? null,
      logChannelId: data.logChannelId,
      deliveryGuildId: data.deliveryGuildId ?? null,
      medalCatalogChannelId: data.medalCatalogChannelId,
      requestPanelChannelId: data.requestPanelChannelId,
      requestPanelMessageId: data.requestPanelMessageId ?? null,
      requestReviewChannelId: data.requestReviewChannelId,
      requestsOpen: data.requestsOpen ?? existing?.requestsOpen ?? false,
    },
    create: {
      requestGuildId: guildId,
      staffRoleId: data.staffRoleId,
      responsibleRoleId: data.responsibleRoleId ?? null,
      logChannelId: data.logChannelId,
      deliveryGuildId: data.deliveryGuildId ?? null,
      ticketCategoryId: compatibilityTicketCategoryId,
      transcriptChannelId: compatibilityTranscriptChannelId,
      medalCatalogChannelId: data.medalCatalogChannelId,
      requestPanelChannelId: data.requestPanelChannelId,
      requestPanelMessageId: data.requestPanelMessageId ?? null,
      requestReviewChannelId: data.requestReviewChannelId,
      requestsOpen: data.requestsOpen ?? false,
    },
  });

  clearSetupData(guildId);
}
