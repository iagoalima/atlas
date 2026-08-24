import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuInteraction,
} from "discord.js";

import { prisma } from "../../infrastructure/database/prisma.js";

export async function handleTicketMedalSelect(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  // ======================================================
  // VERIFICA CUSTOM ID
  // ======================================================

  if (
    !interaction.customId.startsWith(
      "ticket_medal_select:"
    )
  ) {
    return;
  }

  // ======================================================
  // RECUPERA ID DO USUÁRIO
  // ======================================================

  const userId =
    interaction.customId.split(":")[1];

  // ======================================================
  // VERIFICA USUÁRIO
  // ======================================================

  if (
    interaction.user.id !==
    userId
  ) {
    await interaction.reply({
      content:
        "❌ Este menu de seleção pertence a outro usuário.",
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ======================================================
  // VERIFICA SERVIDOR
  // ======================================================

  if (!interaction.guild) {
    await interaction.reply({
      content:
        "❌ Esta interação só pode ser utilizada em um servidor.",
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ======================================================
  // MEDALHAS SELECIONADAS
  // ======================================================

  const medalIds =
    interaction.values;

  // ======================================================
  // VALIDA QUANTIDADE
  // ======================================================

  if (
    medalIds.length < 1 ||
    medalIds.length > 3
  ) {
    await interaction.reply({
      content:
        "❌ Você deve selecionar entre **1 e 3 medalhas**.",
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ======================================================
  // BUSCA MEDALHAS NO BANCO
  // ======================================================

  const medals =
    await prisma.medal.findMany({
      where: {
        id: {
          in: medalIds,
        },
        active: true,
      },
      include: {
        category: true,
      },
    });

  // ======================================================
  // VERIFICA SE TODAS EXISTEM
  // ======================================================

  if (
    medals.length !==
    medalIds.length
  ) {
    await interaction.reply({
      content: [
        "❌ Uma ou mais medalhas selecionadas não estão mais disponíveis.",
        "",
        "Atualize a solicitação e tente novamente.",
      ].join("\n"),
      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  // ======================================================
  // MANTÉM A ORDEM DA SELEÇÃO
  // ======================================================

  const orderedMedals =
    medalIds
      .map(
        (id) =>
          medals.find(
            (medal) =>
              medal.id === id
          )
      )
      .filter(
        (
          medal
        ): medal is NonNullable<
          typeof medal
        > =>
          Boolean(medal)
      );

  // ======================================================
  // CRIA LISTA DE CONFIRMAÇÃO
  // ======================================================

  const medalList =
    orderedMedals
      .map(
        (medal, index) => {
          const emoji =
            medal.emoji
              ? `${medal.emoji} `
              : "🎖️ ";

          return [
            `**${index + 1}.** ${emoji}${medal.name}`,
            `-# Categoria: ${medal.category.name}`,
          ].join("\n");
        }
      )
      .join("\n\n");

  // ======================================================
  // BOTÃO CONFIRMAR
  // ======================================================

  const confirmButton =
    new ButtonBuilder()
      .setCustomId(
        `ticket_medal_confirm:${interaction.user.id}:${medalIds.join(",")}`
      )
      .setLabel(
        "Confirmar solicitação"
      )
      .setEmoji("✅")
      .setStyle(
        ButtonStyle.Success
      );

  // ======================================================
  // BOTÃO VOLTAR
  // ======================================================

  const backButton =
    new ButtonBuilder()
      .setCustomId(
        `ticket_medal_back:${interaction.user.id}`
      )
      .setLabel(
        "Alterar seleção"
      )
      .setEmoji("↩️")
      .setStyle(
        ButtonStyle.Secondary
      );

  // ======================================================
  // ACTION ROW
  // ======================================================

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        confirmButton,
        backButton
      );

  // ======================================================
  // MOSTRA CONFIRMAÇÃO
  // ======================================================

  await interaction.update({
    content: [
      "## 🎖️ Confirmar solicitação",
      "",
      "Você selecionou:",
      "",
      medalList,
      "",
      "Confira as medalhas acima antes de continuar.",
      "",
      "-# Ao confirmar, o Atlas criará seu ticket para análise.",
    ].join("\n"),
    components: [
      row,
    ],
  });

  console.log(
    "🟢 [TICKET] Seleção de medalhas confirmada para revisão:",
    {
      userId:
        interaction.user.id,
      medalIds,
    }
  );
}