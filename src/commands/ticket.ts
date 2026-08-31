import {
  ChannelType,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

import { prisma } from "../infrastructure/database/prisma.js";
import {
  buildSolicitationPanel,
  closeSolicitations,
  ensureSolicitationChannel,
  openSolicitations,
} from "../services/solicitation.service.js";

export const data = new SlashCommandBuilder()
  .setName("solicitacoes")
  .setDescription("Gerencia o sistema sazonal de solicitações de medalhas.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("painel")
      .setDescription("Publica ou atualiza o painel público de solicitações.")
      .addChannelOption((option) =>
        option
          .setName("canal")
          .setDescription("Canal privado onde a equipe receberá as solicitações.")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("abrir")
      .setDescription("Abre o período para novas solicitações.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("fechar")
      .setDescription("Fecha o período para novas solicitações.")
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Este comando só pode ser usado em um servidor.", flags: MessageFlags.Ephemeral });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.permissions.has("Administrator")) {
    await interaction.reply({ content: "❌ Apenas administradores podem gerenciar as solicitações.", flags: MessageFlags.Ephemeral });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "painel") {
    const channel = interaction.options.getChannel("canal", true);
    if (channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: "❌ O canal informado precisa ser um canal de texto.", flags: MessageFlags.Ephemeral });
      return;
    }

    await prisma.guildConfig.update({
      where: { requestGuildId: interaction.guild.id },
      data: { solicitationChannelId: channel.id },
    });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await ensureSolicitationChannel(interaction.guild, channel.id);
      const panelChannelId = await prisma.guildConfig.findUniqueOrThrow({ where: { requestGuildId: interaction.guild.id } });
      if (!panelChannelId.ticketPanelChannelId) {
        await interaction.editReply("❌ O canal público do painel ainda não foi configurado no `/setup`.");
        return;
      }

      const publicChannel = await interaction.guild.channels.fetch(panelChannelId.ticketPanelChannelId);
      if (!publicChannel?.isTextBased()) {
        await interaction.editReply("❌ O canal público configurado não está disponível.");
        return;
      }

      const components = await buildSolicitationPanel(interaction.guild);
      let message = panelChannelId.ticketPanelMessageId
        ? await publicChannel.messages.fetch(panelChannelId.ticketPanelMessageId).catch(() => null)
        : null;

      if (message) {
        await message.edit({ content: null, embeds: [], components, flags: MessageFlags.IsComponentsV2 });
      } else {
        message = await publicChannel.send({ components, flags: MessageFlags.IsComponentsV2 });
      }

      await prisma.guildConfig.update({
        where: { requestGuildId: interaction.guild.id },
        data: {
          ticketPanelChannelId: publicChannel.id,
          ticketPanelMessageId: message.id,
        },
      });

      await interaction.editReply([
        "## 🟢 Sistema de solicitações configurado",
        "",
        `📢 **Painel público:** ${publicChannel}`,
        `🔒 **Canal da equipe:** ${channel}`,
        "",
        "O painel foi publicado e o canal da equipe foi protegido para acesso exclusivo da equipe e dos responsáveis.",
      ].join("\n"));
    } catch (error) {
      console.error("❌ [SOLICITAÇÕES] Erro ao configurar painel:", error);
      await interaction.editReply("❌ Não foi possível configurar o sistema de solicitações. Verifique as permissões do Atlas.");
    }
    return;
  }

  if (subcommand === "abrir") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await openSolicitations(interaction.guild);
      const config = await prisma.guildConfig.findUniqueOrThrow({ where: { requestGuildId: interaction.guild.id } });
      if (config.ticketPanelChannelId && config.ticketPanelMessageId) {
        const channel = await interaction.guild.channels.fetch(config.ticketPanelChannelId);
        if (channel?.isTextBased()) {
          const message = await channel.messages.fetch(config.ticketPanelMessageId).catch(() => null);
          if (message) {
            await message.edit({ content: null, embeds: [], components: await buildSolicitationPanel(interaction.guild), flags: MessageFlags.IsComponentsV2 });
          }
        }
      }
      await interaction.editReply("## 🟢 Solicitações reabertas\n\nNovas solicitações já podem ser enviadas pelo painel público.");
    } catch (error) {
      console.error("❌ [SOLICITAÇÕES] Erro ao abrir:", error);
      await interaction.editReply("❌ Não foi possível abrir as solicitações. Configure primeiro o sistema com `/solicitacoes painel`.");
    }
    return;
  }

  if (subcommand === "fechar") {
    await closeSolicitations(interaction.guild);
    const config = await prisma.guildConfig.findUniqueOrThrow({ where: { requestGuildId: interaction.guild.id } });
    if (config.ticketPanelChannelId && config.ticketPanelMessageId) {
      const channel = await interaction.guild.channels.fetch(config.ticketPanelChannelId);
      if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(config.ticketPanelMessageId).catch(() => null);
        if (message) {
          await message.edit({ content: null, embeds: [], components: await buildSolicitationPanel(interaction.guild), flags: MessageFlags.IsComponentsV2 });
        }
      }
    }
    await interaction.reply({ content: "## 🔒 Solicitações encerradas\n\nNovos pedidos estão bloqueados. As solicitações já enviadas continuam em análise normalmente.", flags: MessageFlags.Ephemeral });
  }
}
