import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { prisma } from "../infrastructure/database/prisma.js";
import { announceRequestState, getRequestState, setRequestsOpen } from "../services/request-season.service.js";
import { createRequestPanel } from "../services/request-panel.service.js";

export const data = new SlashCommandBuilder()
  .setName("solicitacoes")
  .setDescription("Gerencia as solicitações sazonais de medalhas.")
  .addSubcommand((s) => s.setName("painel").setDescription("Publica ou atualiza o painel de solicitações."))
  .addSubcommand((s) => s.setName("abrir").setDescription("Abre uma nova temporada de solicitações."))
  .addSubcommand((s) => s.setName("fechar").setDescription("Fecha novas solicitações sem interromper as já recebidas."));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) { await interaction.reply({ content: "❌ Este comando só pode ser usado em um servidor.", flags: MessageFlags.Ephemeral }); return; }
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.permissions.has("Administrator")) { await interaction.reply({ content: "❌ Apenas administradores podem gerenciar as solicitações.", flags: MessageFlags.Ephemeral }); return; }
  const subcommand = interaction.options.getSubcommand();
  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: interaction.guild.id } });

  if (subcommand === "painel") {
    if (!config?.requestPanelChannelId) { await interaction.reply({ content: "## ⚙️ Canal não configurado\n\nConfigure o **Painel público** no `/setup` antes de publicar o painel.", flags: MessageFlags.Ephemeral }); return; }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const messageId = await createRequestPanel(interaction.guild, config.requestPanelChannelId);
      await interaction.editReply({ content: `## 🟢 Painel publicado\n\nO painel de solicitações foi criado/atualizado em <#${config.requestPanelChannelId}>.\n\n-# Mensagem: \`${messageId}\`` });
    } catch (error) { console.error("❌ [REQUEST PANEL] Erro:", error); await interaction.editReply({ content: "## ❌ Não foi possível publicar o painel\n\nVerifique as permissões do Atlas no canal configurado." }); }
    return;
  }

  const open = subcommand === "abrir";
  const current = await getRequestState(interaction.guild.id);
  if (current === open) { await interaction.reply({ content: open ? "⚠️ As solicitações já estão abertas." : "⚠️ As solicitações já estão fechadas.", flags: MessageFlags.Ephemeral }); return; }
  await setRequestsOpen(interaction.guild.id, open);
  await announceRequestState(interaction.guild, open);
  await prisma.auditLog.create({ data: { action: "CONFIG_UPDATED", executorId: interaction.user.id, details: { field: "requestsOpen", after: open, description: open ? "Temporada de solicitações aberta." : "Novas solicitações encerradas; solicitações existentes permanecem em análise." } } });
  await interaction.reply({ content: open ? "## 🟢 Solicitações abertas\n\nUma nova temporada foi iniciada." : "## 🔴 Solicitações fechadas\n\nNovas solicitações estão bloqueadas. As solicitações já enviadas continuam normalmente.", flags: MessageFlags.Ephemeral });
}
