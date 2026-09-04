import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, Guild, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder } from "discord.js";
import { prisma } from "../infrastructure/database/prisma.js";

function buildPanel(): ContainerBuilder {
  return new ContainerBuilder().setAccentColor(0x3498db)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      "# 🎖️ Solicitações de Medalhas", "",
      "O Atlas centraliza aqui o processo de solicitação de medalhas do Exército Brasileiro.",
    ].join("\n")))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      "## 📋 Como funciona", "",
      "1. Selecione de **1 a 3 medalhas**.",
      "2. Informe seu nome de usuário no Roblox.",
      "3. Envie as provas de **cada medalha separadamente**.",
      "4. Aguarde a análise individual da equipe.",
      "5. Após a aprovação, um responsável autorizado realizará a entrega.",
      "6. Você receberá mensagens privadas quando a solicitação for registrada, analisada e entregue.",
    ].join("\n")))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      "## 📎 Obrigações do solicitante", "",
      "- Enviar provas verdadeiras, completas e legíveis.",
      "- Enviar as provas correspondentes à medalha solicitada.",
      "- Não misturar provas de medalhas diferentes durante o envio.",
      "- Informar corretamente o nome no Roblox.",
      "- Aguardar a análise da equipe após concluir o envio.",
      "-# Solicitações incompletas podem não ser aprovadas.",
    ].join("\n")))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("request_start").setLabel("Solicitar medalhas").setEmoji("🎖️").setStyle(ButtonStyle.Primary),
    ));
}

export async function createRequestPanel(guild: Guild, channelId: string): Promise<string> {
  const channel = await guild.channels.fetch(channelId);
  if (!channel?.isTextBased() || !channel.isSendable()) throw new Error("O canal do painel de solicitações não foi encontrado ou não permite mensagens.");
  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: guild.id } });
  if (!config) throw new Error("O servidor ainda não possui configuração do Atlas.");
  if (config.requestPanelMessageId) {
    const existing = await channel.messages.fetch(config.requestPanelMessageId).catch(() => null);
    if (existing) {
      await existing.edit({ content: null, embeds: [], components: [buildPanel()], flags: MessageFlags.IsComponentsV2 });
      await prisma.guildConfig.update({ where: { requestGuildId: guild.id }, data: { requestPanelChannelId: channel.id, requestPanelMessageId: existing.id } });
      return existing.id;
    }
  }
  const message = await channel.send({ components: [buildPanel()], flags: MessageFlags.IsComponentsV2 });
  await prisma.guildConfig.update({ where: { requestGuildId: guild.id }, data: { requestPanelChannelId: channel.id, requestPanelMessageId: message.id } });
  return message.id;
}
