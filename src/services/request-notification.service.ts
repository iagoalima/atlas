import { Client } from "discord.js";
import { prisma } from "../infrastructure/database/prisma.js";

export function startRequestNotifications(client: Client): void {
  const startedAt = new Date();
  const handled = new Set<string>();

  const poll = async () => {
    const events = await prisma.auditLog.findMany({
      where: {
        createdAt: { gte: startedAt },
        action: { in: ["MEDAL_APPROVED", "MEDAL_DENIED", "MEDAL_GRANTED"] },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    for (const event of events) {
      if (handled.has(event.id) || !event.targetId) continue;
      handled.add(event.id);
      const data = event.details && typeof event.details === "object" && !Array.isArray(event.details) ? event.details as Record<string, unknown> : {};
      const medalName = typeof data.medalName === "string" ? data.medalName : "a medalha";
      let content: string;
      if (event.action === "MEDAL_APPROVED") {
        content = `## 🟢 Medalha aprovada\n\nSua solicitação da medalha **${medalName}** foi aprovada pela equipe.\n\n-# A próxima etapa é a entrega por um responsável autorizado.`;
      } else if (event.action === "MEDAL_DENIED") {
        const reason = typeof data.reason === "string" && data.reason ? `\n\n**Justificativa:** ${data.reason}` : "";
        content = `## 🔴 Medalha negada\n\nSua solicitação da medalha **${medalName}** foi negada pela equipe.${reason}`;
      } else {
        content = `## 🏅 Medalha entregue\n\nA medalha **${medalName}** foi efetivamente entregue no servidor do EB.\n\n-# Sua solicitação foi concluída para esta medalha.`;
      }
      try {
        const user = await client.users.fetch(event.targetId);
        await user.send(content);
      } catch (error) {
        console.warn("⚠️ [REQUEST NOTIFICATION] Não foi possível enviar DM:", error);
      }
    }
  };

  void poll();
  setInterval(() => void poll().catch((error) => console.error("❌ [REQUEST NOTIFICATION] Erro:", error)), 5000);
}
