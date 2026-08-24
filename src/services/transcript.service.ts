import {
    TextChannel,
} from "discord.js";

import {
    createTranscript,
} from "@devjacob/discord-html-transcripts";

import { prisma } from "../infrastructure/database/prisma.js";

import {
    logAuditEvent,
} from "./audit-log.service.js";

// ==========================================================
// CRIA TRANSCRIPT DO TICKET
// ==========================================================

export async function createTicketTranscript(
    channel: TextChannel,
    ticketId: string,
    executorId: string
): Promise<string | null> {
    // ========================================================
    // VERIFICA SE JÁ EXISTE
    // ========================================================

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

    // ========================================================
    // BUSCA TICKET
    // ========================================================

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

    // ========================================================
    // BUSCA CONFIGURAÇÃO
    // ========================================================

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

    // ========================================================
    // BUSCA CANAL DE TRANSCRIPTS
    // ========================================================

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

    // ========================================================
    // GERA TRANSCRIPT
    // ========================================================

    console.log(
        "📄 [TRANSCRIPT] Gerando transcript:",
        ticketId
    );

    /*
     * @devjacob/discord-html-transcripts possui declarações
     * próprias que podem entrar em conflito com os tipos
     * do discord.js do projeto quando:
     *
     * exactOptionalPropertyTypes = true
     *
     * Em runtime, porém, trata-se do mesmo objeto do
     * discord.js. O cast fica restrito somente à chamada
     * da biblioteca.
     */

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

    // ========================================================
    // ENVIA TRANSCRIPT
    // ========================================================

    const message =
        await transcriptChannel.send({
            content: [
                "## 📄 Transcript do Ticket",
                "",
                `🎫 **Ticket:** \`#${ticket.ticketNumber}\``,
                `👤 **Usuário:** <@${ticket.userId}>`,
                "",
                "A transcrição completa desta solicitação está anexada abaixo.",
            ].join("\n"),

            files: [
                transcript,
            ],
        });

    // ========================================================
    // OBTÉM URL
    // ========================================================

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

    // ========================================================
    // SALVA NO BANCO
    // ========================================================

    await prisma.transcript.create({
        data: {
            ticketId,

            url,
        },
    });

    // ========================================================
    // AUDITORIA
    // ========================================================

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

    // ========================================================
    // LOG LOCAL
    // ========================================================

    console.log(
        "📄 [TRANSCRIPT] Transcript criada:",
        {
            ticketId,

            url,
        }
    );

    return url;
}