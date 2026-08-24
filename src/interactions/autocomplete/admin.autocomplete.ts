import { AutocompleteInteraction } from "discord.js";

import { client } from "../../core/discord/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function limitChoices<T>(choices: T[]): T[] {
  return choices.slice(0, 25);
}

async function handleCategoryAutocomplete(
  interaction: AutocompleteInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const focused = interaction.options.getFocused();
  const active = subcommand !== "reativar";

  const categories = await prisma.medalCategory.findMany({
    where: {
      active,
      ...(focused
        ? {
            name: {
              contains: focused,
              mode: "insensitive",
            },
          }
        : {}),
    },
    orderBy: [
      { position: "asc" },
      { name: "asc" },
    ],
    take: 25,
  });

  await interaction.respond(
    limitChoices(
      categories.map((category) => ({
        name: `${category.emoji ?? "🗂️"} ${category.name}`.slice(0, 100),
        value: category.id,
      }))
    )
  );
}

async function handleMedalAutocomplete(
  interaction: AutocompleteInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const focused = interaction.options.getFocused();
  const categoryIdentifier = interaction.options.getString("categoria");
  const active = subcommand !== "reativar";

  let categoryId: string | undefined;

  if (categoryIdentifier) {
    const category = await prisma.medalCategory.findFirst({
      where: {
        OR: [
          { id: categoryIdentifier },
          {
            name: {
              equals: categoryIdentifier,
              mode: "insensitive",
            },
          },
        ],
      },
      select: { id: true },
    });

    categoryId = category?.id;
  }

  const medals = await prisma.medal.findMany({
    where: {
      active,
      ...(categoryId ? { categoryId } : {}),
      ...(focused
        ? {
            name: {
              contains: focused,
              mode: "insensitive",
            },
          }
        : {}),
    },
    include: {
      category: {
        select: {
          name: true,
          emoji: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
    take: 25,
  });

  await interaction.respond(
    limitChoices(
      medals.map((medal) => ({
        name: `${medal.emoji ?? "🎖️"} ${medal.name} • ${medal.category.emoji ?? "🗂️"} ${medal.category.name}`.slice(0, 100),
        value: medal.id,
      }))
    )
  );
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isAutocomplete()) return;

  try {
    if (interaction.commandName === "categoria-admin") {
      if (interaction.options.getFocused(true).name === "categoria") {
        await handleCategoryAutocomplete(interaction);
      }
      return;
    }

    if (interaction.commandName === "medal-admin") {
      const focusedOption = interaction.options.getFocused(true);

      if (focusedOption.name === "categoria") {
        await handleCategoryAutocomplete(interaction);
      } else if (focusedOption.name === "medalha") {
        await handleMedalAutocomplete(interaction);
      }
    }
  } catch (error) {
    console.error("❌ [AUTOCOMPLETE] Erro ao gerar opções administrativas:", error);

    if (!interaction.responded) {
      await interaction.respond([]).catch(() => undefined);
    }
  }
});

void normalize;