import { AuditAction, Prisma } from "../generated/prisma/client.js";
import { ContainerBuilder, Guild, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder } from "discord.js";
import { prisma } from "../infrastructure/database/prisma.js";

export interface CreateAuditLogParams { action: AuditAction; executorId: string; targetId?: string | null; ticketId?: string | null; medalId?: string | null; details?: Prisma.InputJsonValue | null; }
export interface SendAuditLogParams extends CreateAuditLogParams { guild: Guild; }

const actionLabels: Record<AuditAction, { title: string; description: string }> = {
  TICKET_CREATED: { title: "🎖️ Solicitação criada", description: "Uma nova solicitação foi registrada no sistema." },
  TICKET_CLOSED: { title: "🔒 Solicitação encerrada", description: "O processo desta solicitação foi encerrado." },
  TICKET_DELETED: { title: "🗑️ Solicitação excluída", description: "Uma solicitação foi removida do sistema." },
  MEDAL_CREATED: { title: "🏅 Medalha criada", description: "Uma nova medalha foi cadastrada no Atlas." },
  MEDAL_UPDATED: { title: "✏️ Medalha atualizada", description: "Uma medalha cadastrada no Atlas foi alterada." },
  MEDAL_REMOVED: { title: "🗑️ Medalha removida", description: "Uma medalha foi desativada no Atlas." },
  MEDAL_APPROVED: { title: "✅ Medalha aprovada", description: "A solicitação foi analisada e aprovada." },
  MEDAL_ACCEPTED: { title: "🪖 Medalha aceita para entrega", description: "Um responsável autorizado assumiu a entrega." },
  MEDAL_GRANTED: { title: "🏅 Medalha entregue", description: "A medalha foi efetivamente entregue no servidor de destino." },
  MEDAL_DENIED: { title: "❌ Medalha negada", description: "A solicitação de medalha foi recusada durante a análise." },
  MEDAL_SELF_DELIVERY_BLOCKED: { title: "🚫 Autoentrega bloqueada", description: "O Atlas bloqueou uma tentativa de autoentrega." },
  MEDAL_SELF_DELIVERY_ATTEMPT: { title: "🚨 Tentativa de autoentrega", description: "Um membro tentou entregar uma medalha para si próprio." },
  TRANSCRIPT_CREATED: { title: "📄 Transcrição criada", description: "Uma transcrição foi gerada e armazenada." },
  CONFIG_UPDATED: { title: "⚙️ Configuração atualizada", description: "Uma configuração do Atlas foi alterada." },
  CATEGORY_CREATED: { title: "📁 Categoria criada", description: "Uma nova categoria de medalhas foi cadastrada." },
  CATEGORY_UPDATED: { title: "✏️ Categoria atualizada", description: "Uma categoria de medalhas foi alterada." },
  CATEGORY_REMOVED: { title: "🗑️ Categoria removida", description: "Uma categoria de medalhas foi desativada." },
};

function getActionColor(action: AuditAction): number {
  switch (action) {
    case "MEDAL_APPROVED": return 0x2ecc71;
    case "MEDAL_ACCEPTED": return 0xe67e22;
    case "MEDAL_GRANTED": return 0xf1c40f;
    case "MEDAL_DENIED":
    case "MEDAL_SELF_DELIVERY_BLOCKED": return 0xe74c3c;
    case "MEDAL_SELF_DELIVERY_ATTEMPT": return 0xc0392b;
    case "TICKET_CLOSED":
    case "TICKET_DELETED":
    case "MEDAL_REMOVED":
    case "CATEGORY_REMOVED": return 0x95a5a6;
    case "CONFIG_UPDATED": return 0x9b59b6;
    default: return 0x3498db;
  }
}
function formatDate(): string { return `<t:${Math.floor(Date.now() / 1000)}:F>`; }
function formatUser(id?: string | null): string | null { return id ? `<@${id}>` : null; }
function asRecord(details?: Prisma.InputJsonValue | null): Record<string, unknown> | null { if (!details || typeof details !== "object" || Array.isArray(details)) return null; return details as Record<string, unknown>; }
function displayValue(value: unknown): string { if (value === null || value === undefined || value === "") return "Não definido"; if (typeof value === "boolean") return value ? "Ativo" : "Inativo"; if (Array.isArray(value)) return value.length ? value.join(", ") : "Nenhum"; return String(value); }
function buildChangeLines(data: Record<string, unknown>): string[] { const changes = data.changes; if (!Array.isArray(changes)) return []; return changes.flatMap((change) => { if (!change || typeof change !== "object" || Array.isArray(change)) return []; const item = change as Record<string, unknown>; return typeof item.field === "string" ? [`• **${item.field}:** ${displayValue(item.before)} → ${displayValue(item.after)}`] : []; }); }
async function formatTicket(guild: Guild, ticketId?: string | null, details?: Prisma.InputJsonValue | null): Promise<string | null> { const data = asRecord(details); if (typeof data?.ticketNumber === "number") return `#${data.ticketNumber}`; if (typeof data?.ticketNumber === "string" && data.ticketNumber.trim()) return `#${data.ticketNumber.replace(/^#/, "")}`; if (!ticketId) return null; try { const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { ticketNumber: true } }); return ticket?.ticketNumber ? `#${ticket.ticketNumber}` : "Solicitação"; } catch { return "Solicitação"; } }
function formatMedal(medalId?: string | null, details?: Prisma.InputJsonValue | null): string | null { const data = asRecord(details); const name = data?.medalName ?? data?.name; if (typeof name === "string" && name.trim()) return `**${name}**`; return medalId ? "Medalha" : null; }
function buildDetailsSection(action: AuditAction, details?: Prisma.InputJsonValue | null): string | null { const data = asRecord(details); if (!data) return null; const lines: string[] = []; const changes = buildChangeLines(data); if (changes.length) lines.push("## 🔧 Alterações", "", ...changes); if (action === "TRANSCRIPT_CREATED" && typeof data.url === "string") lines.push("", `📄 **Transcrição:** [Visualizar transcrição](${data.url})`); if (action === "MEDAL_APPROVED" || action === "MEDAL_DENIED") if (data.reason) lines.push(`📝 **Justificativa:** ${displayValue(data.reason)}`); if (action === "MEDAL_GRANTED" && Array.isArray(data.addedRoleNames)) lines.push(`🎖️ **Cargos concedidos:** ${displayValue(data.addedRoleNames)}`); if (action === "MEDAL_ACCEPTED" && data.deliveryRoleName) lines.push(`🪖 **Responsável pela entrega:** ${displayValue(data.deliveryRoleName)}`); if (action === "CONFIG_UPDATED") { if (data.field) lines.push(`⚙️ **Configuração:** ${displayValue(data.field)}`); if (data.description) lines.push(`📝 **Alteração:** ${displayValue(data.description)}`); } return lines.length ? lines.join("\n") : null; }

export async function createAuditLog(params: CreateAuditLogParams) { return prisma.auditLog.create({ data: { action: params.action, executorId: params.executorId, ...(params.targetId !== undefined ? { targetId: params.targetId } : {}), ...(params.ticketId !== undefined ? { ticketId: params.ticketId } : {}), ...(params.medalId !== undefined ? { medalId: params.medalId } : {}), ...(params.details !== undefined ? { details: params.details ?? Prisma.JsonNull } : {}) } }); }

export async function sendAuditLog(params: SendAuditLogParams): Promise<void> {
  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: params.guild.id } });
  if (!config?.logChannelId) return;
  const channel = await params.guild.channels.fetch(config.logChannelId).catch(() => null);
  if (!channel?.isTextBased() || !channel.isSendable()) return;
  const actionInfo = actionLabels[params.action];
  const ticketDisplay = await formatTicket(params.guild, params.ticketId, params.details);
  const medalDisplay = formatMedal(params.medalId, params.details);
  const detailsSection = buildDetailsSection(params.action, params.details);
  const container = new ContainerBuilder().setAccentColor(getActionColor(params.action)).addTextDisplayComponents(new TextDisplayBuilder().setContent([`# ${actionInfo.title}`, "", actionInfo.description].join("\n"))).addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)).addTextDisplayComponents(new TextDisplayBuilder().setContent(["## 📋 Evento", "", `🕐 **Data:** ${formatDate()}`, `🛡️ **Responsável:** ${formatUser(params.executorId) ?? "Não informado"}`].join("\n")));
  if (params.targetId) container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)).addTextDisplayComponents(new TextDisplayBuilder().setContent(["## 👤 Solicitante", "", formatUser(params.targetId) ?? "Não informado"].join("\n")));
  const context: string[] = []; if (ticketDisplay) context.push(`🎖️ **Solicitação:** ${ticketDisplay}`); if (medalDisplay) context.push(`🏅 **Medalha:** ${medalDisplay}`);
  if (context.length) container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)).addTextDisplayComponents(new TextDisplayBuilder().setContent(["## 📌 Referência", "", ...context].join("\n")));
  if (detailsSection) container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)).addTextDisplayComponents(new TextDisplayBuilder().setContent(detailsSection));
  await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
}
export async function logAuditEvent(params: SendAuditLogParams): Promise<void> { await createAuditLog(params); await sendAuditLog(params); }
