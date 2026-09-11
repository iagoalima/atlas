import { Guild } from "discord.js";
import { publishAnalysisDashboard } from "./analysis-dashboard.service.js";

/**
 * Compatibilidade com chamadas antigas.
 * O Atlas não possui mais um dashboard público: a Central de Análise
 * é exclusivamente interna e usa dashboard.png.
 */
export async function createAtlasDashboard(
  guild: Guild,
  channelId: string
): Promise<string> {
  return publishAnalysisDashboard(guild, channelId);
}
