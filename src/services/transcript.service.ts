import {
    ContainerBuilder,
    MessageFlags,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    TextChannel,
} from "discord.js";

import {
    createTranscript,
} from "@devjacob/discord-html-transcripts";

import { prisma } from "../infrastructure/database/prisma.js";

import {
    logAuditEvent,
} from "./audit-log.service.js";

export async function createTicketTranscript(
    channel: TextChannel,
    ticketId: string,
    executorId: string
): Promise<string | null> {
    const existingTranscript =
        await prisma.transcript.findUnique({
            where: {
                ticketId,
            },
        });

    if (existingTranscript) {
        console.log(
            "ℹ️ [TRANSCRIPT] Transcript já existente:",
            ticketId
        );

        return existingTranscript.url;
    }

    const ticket =
        await prisma.ticket.findUnique({
            where: {
                id: ticketId,
            },
        });

    if (!ticket) {
        console.warn(
            "⚠️ [TRANSCRIPT] Ticket não encontrado:",
            ticketId
        );

        return null;
    }

    const config =
        await prisma.guildConfig.findUnique({
            where: {
                requestGuildId:
                    channel.guild.id,
            },
        });

    if (!config?.transcriptChannelId) {
        console.warn(
            "⚠️ [TRANSCRIPT] Canal de transcripts não configurado:",
            channel.guild.id
        );

        return null;
    }

    const transcriptChannel =
        await channel.client.channels.fetch(
            config.transcriptChannelId
        );

    if (
        !transcriptChannel ||
        !transcriptChannel.isTextBased()
    ) {
        console.warn(
            "⚠️ [TRANSCRIPT] Canal de transcripts inválido:",
            config.transcriptChannelId
        );

        return null;
    }

    if (
        !("send" in transcriptChannel)
    ) {
        console.warn(
            "⚠️ [TRANSCRIPT] Canal não permite envio:",
            config.transcriptChannelId
        );

        return null;
    }

    console.log(
        "📄 [TRANSCRIPT] Gerando transcript:",
        ticketId
    );

    const transcript =
        await createTranscript(
            channel as unknown as Parameters<
                typeof createTranscript
            >[0],
            {
                limit: -1,
                filename:
                    `ticket-${ticket.ticketNumber}.html`,
                poweredBy:
                    false,
            }
        );

    const transcriptContainer =
        new ContainerBuilder()
            .setAccentColor(0x5865f2)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    [
                        "# 📄 Transcript do Ticket",
                        "",
                        `🎫 **Ticket:** \`#${ticket.ticketNumber}\``,
                        `👤 **Usuário:** <@${ticket.userId}>`,
                    ].join("\n")
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    [
                        "## 📎 Arquivo",
                        "",
                        "A transcrição completa desta solicitação está anexada abaixo.",
                        "",
                        "-# O transcript foi gerado pelo Atlas e permanece registrado para histórico e auditoria.",
                    ].join("\n")
                )
            );

    const message =
        await transcriptChannel.send({
            components: [
                transcriptContainer,
            ],
            flags: MessageFlags.IsComponentsV2,
            files: [
                transcript,
            ],
        });

    const attachment =
        message.attachments.first();

    if (!attachment) {
        console.error(
            "❌ [TRANSCRIPT] Arquivo não encontrado após envio:",
            ticketId
        );

        return null;
    }

    const url =
        attachment.url;

    await prisma.transcript.create({
        data: {
            ticketId,
            url,
        },
    });

    await logAuditEvent({
        guild:
            channel.guild,
        action:
            "TRANSCRIPT_CREATED",
        executorId,
        targetId:
            ticket.userId,
        ticketId,
        details: {
            url,
            transcriptChannelId:
                config.transcriptChannelId,
        },
    });

    console.log(
        "📄 [TRANSCRIPT] Transcript criada:",
        {
            ticketId,
            url,
        }
    );

    return url;
}