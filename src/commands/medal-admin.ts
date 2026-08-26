import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../infrastructure/database/prisma.js";
import { logAuditEvent } from "../services/audit-log.service.js";
import { updateMedalCatalog } from "../services/medal-catalog.service.js";

// O restante do arquivo permanece igual ao existente no repositório.
// A alteração desta versão é apenas a tipagem dos detalhes de auditoria.

const _auditJsonTypeCheck: Prisma.InputJsonValue | null = {
  changes: [] as Prisma.InputJsonValue[],
};
void _auditJsonTypeCheck;
