import {
    ContainerBuilder,
    MessageFlags,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    TextChannel,
} from "discord.js";

import { createTranscript } from "@devjacob/discord-html-transcripts";
import { prisma } from "../infrastructure/database/prisma.js";
import { logAuditEvent } from "./audit-log.service.js";

export async function createTicketTranscript(
    channel: TextChannel,
    ticketId: string,
    executorId: string
): Promise<string | null> {
    const existingTranscript = await prisma.transcript.findUnique({ where: { ticketId } });
    if (existingTranscript) return existingTranscript.url;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return null;

    const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: channel.guild.id } });
    if (!config?.transcriptChannelId) return null;

    const transcriptChannel = await channel.client.channels.fetch(config.transcriptChannelId).catch(() => null);
    if (!transcriptChannel?.isTextBased() || !("send" in transcriptChannel)) return null;

    const transcript = await createTranscript(channel as unknown as Parameters<typeof createTranscript>[0], {
        limit: -1,
        filename: `ticket-${ticket.ticketNumber}.html`,
        poweredBy: false,
    });

    const participantMap = new Map<string, string>();
    participantMap.set(ticket.userId, ticket.username);

    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (messages) {
        for (const message of messages.values()) {
            if (message.author.bot) continue;
            participantMap.set(message.author.id, message.author.username);
        }
    }

    const participants = [...participantMap.entries()].map(([id, username]) => ({ id, username }));
    const participantLines = participants.map(({ id, username }) => `<@${id}> | ${username}`);

    const transcriptContainer = new ContainerBuilder()
        .setAccentColor(0x5865f2)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent([
                "# 📄 Transcript do Ticket",
                "",
                `🎫 **Ticket:** \`#${ticket.ticketNumber}\``,
                `👤 **Solicitante:** <@${ticket.userId}> | ${ticket.username}`,
            ].join("\n"))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent([
                "## 👥 Participantes",
                "",
                ...participantLines,
            ].join("\n"))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent([
                "## 📎 Arquivo",
                "",
                "A transcrição completa desta solicitação está anexada abaixo.",
                "",
                "-# O transcript foi gerado pelo Atlas e permanece registrado para histórico e auditoria.",
            ].join("\n"))
        );

    const message = await transcriptChannel.send({
        components: [transcriptContainer],
        flags: MessageFlags.IsComponentsV2,
        files: [transcript],
    });

    const attachment = message.attachments.first();
    if (!attachment) return null;

    const url = attachment.url;

    await prisma.transcript.create({ data: { ticketId, url } });

    await logAuditEvent({
        guild: channel.guild,
        action: "TRANSCRIPT_CREATED",
        executorId,
        targetId: ticket.userId,
        ticketId,
        details: {
            url,
            transcriptChannelId: config.transcriptChannelId,
            ticketNumber: ticket.ticketNumber,
            participants,
        },
    });

    return url;
}
