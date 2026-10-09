import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, Guild, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder } from "discord.js";
import path from "node:path";
import { prisma } from "../infrastructure/database/prisma.js";

const BANNER_PATH = path.resolve(process.cwd(), "assets/panels/solicitacoes.png");

function buildPanel(): ContainerBuilder {
  return new ContainerBuilder().setAccentColor(0x1f4f78)
    .addMediaGalleryComponents((gallery) => gallery.addItems((item) => item.setURL("attachment://solicitacoes.png")))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      "# 🎖️ CENTRAL DE SOLICITAÇÕES",
      "",
      "O Atlas centraliza aqui o processo oficial de solicitação de medalhas.",
      "-# Selecione de 1 a 3 medalhas e acompanhe cada etapa individualmente.",
    ].join("\n")))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      "## 📋 Como funciona",
      "",
      "**01** • Selecione de **1 a 3 medalhas**.",
      "**02** • Informe seu nome de usuário no Roblox.",
      "**03** • Envie as provas de cada medalha separadamente pelo privado.",
      "**04** • Aguarde a análise individual da equipe.",
      "**05** • Após a aprovação, a entrega é realizada por um responsável autorizado.",
      "**06** • O Atlas envia as atualizações importantes diretamente no privado.",
    ].join("\n")))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      "## 📎 Antes de começar",
      "",
      "Tenha em mãos provas **verdadeiras, completas e legíveis** para cada medalha.",
      "",
      "⚠️ **É obrigatório manter as mensagens privadas (DMs) abertas.** O Atlas precisa conseguir enviar mensagens no seu privado para solicitar o envio das provas e comunicar atualizações sobre o andamento da solicitação.",
      "",
      "-# O Atlas organiza as provas por medalha para evitar confusão durante a análise.",
    ].join("\n")))
    .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("request_start").setLabel("Iniciar solicitação").setEmoji("🎖️").setStyle(ButtonStyle.Primary),
    ));
}

export async function createRequestPanel(guild: Guild, channelId: string): Promise<string> {
  const channel = await guild.channels.fetch(channelId);
  if (!channel?.isTextBased() || !channel.isSendable()) throw new Error("O canal do painel de solicitações não foi encontrado ou não permite mensagens.");
  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: guild.id } });
  if (!config) throw new Error("O servidor ainda não possui configuração do Atlas.");
  const payload = { components: [buildPanel()], files: [{ attachment: BANNER_PATH, name: "solicitacoes.png" }], flags: MessageFlags.IsComponentsV2 as const };
  if (config.requestPanelMessageId) {
    const existing = await channel.messages.fetch(config.requestPanelMessageId).catch(() => null);
    if (existing) { await existing.edit(payload); await prisma.guildConfig.update({ where: { requestGuildId: guild.id }, data: { requestPanelChannelId: channel.id } }); return existing.id; }
  }
  const message = await channel.send(payload);
  await prisma.guildConfig.update({ where: { requestGuildId: guild.id }, data: { requestPanelChannelId: channel.id, requestPanelMessageId: message.id } });
  return message.id;
}
