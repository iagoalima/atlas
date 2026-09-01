import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { prisma } from "../infrastructure/database/prisma.js";
import { announceRequestState, getRequestState, setRequestsOpen } from "../services/request-season.service.js";

export const data = new SlashCommandBuilder()
  .setName("solicitacoes")
  .setDescription("Controla a abertura das solicitações de medalhas.")
  .addSubcommand((sub) => sub.setName("abrir").setDescription("Abre uma nova temporada de solicitações."))
  .addSubcommand((sub) => sub.setName("fechar").setDescription("Fecha novas solicitações sem interromper as já recebidas."));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Este comando só pode ser usado em um servidor.", flags: MessageFlags.Ephemeral });
    return;
  }
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.permissions.has("Administrator")) {
    await interaction.reply({ content: "❌ Apenas administradores podem controlar as temporadas de solicitações.", flags: MessageFlags.Ephemeral });
    return;
  }

  const open = interaction.options.getSubcommand() === "abrir";
  const current = await getRequestState(interaction.guild.id);
  if (current === open) {
    await interaction.reply({
      content: open ? "⚠️ As solicitações já estão abertas." : "⚠️ As solicitações já estão fechadas.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await setRequestsOpen(interaction.guild.id, open);
  await announceRequestState(interaction.guild, open);

  await prisma.auditLog.create({
    data: {
      action: "CONFIG_UPDATED",
      executorId: interaction.user.id,
      details: {
        field: "requestsOpen",
        after: open,
        description: open ? "Temporada de solicitações aberta." : "Novas solicitações encerradas; solicitações existentes permanecem em análise.",
      },
    },
  });

  await interaction.reply({
    content: open
      ? "## 🟢 Solicitações abertas\n\nUma nova temporada de solicitações foi iniciada."
      : "## 🔴 Solicitações fechadas\n\nNovas solicitações estão bloqueadas. As solicitações já enviadas continuam normalmente.",
    flags: MessageFlags.Ephemeral,
  });
}
