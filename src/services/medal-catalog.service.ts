import {
  ContainerBuilder,
  Guild,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextChannel,
  TextDisplayBuilder,
} from "discord.js";
import path from "node:path";

import { prisma } from "../infrastructure/database/prisma.js";

const BANNER_PATH = path.resolve(
  process.cwd(),
  "assets/panels/catalogo.png"
);

function formatDate(date: Date): string {
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cleanText(text: string): string {
  return text.trim();
}

function buildDeliveryPermissionRoles(
  guild: Guild,
  roles: { roleId: string }[]
): string {
  if (roles.length === 0) {
    return "_Nenhum cargo autorizado para entrega configurado._";
  }

  return roles
    .map(({ roleId }) => {
      const role = guild.roles.cache.get(roleId);

      if (!role) {
        return `\`Cargo não encontrado: ${roleId}\``;
      }

      return `<@&${role.id}>`;
    })
    .join(" • ");
}

function hexToNumber(hex: string): number | null {
  const normalized = hex.replace("#", "").trim();

  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
    return null;
  }

  return parseInt(normalized, 16);
}

export async function buildCatalogPresentation(
  guild: Guild
): Promise<ContainerBuilder> {
  const [categoryCount, medalCount] = await Promise.all([
    prisma.medalCategory.count({
      where: {
        active: true,
      },
    }),
    prisma.medal.count({
      where: {
        active: true,
        category: {
          active: true,
        },
      },
    }),
  ]);

  const container = new ContainerBuilder().setAccentColor(0x1f4f78);

  container.addMediaGalleryComponents((gallery) =>
    gallery.addItems((item) =>
      item.setURL("attachment://catalogo.png")
    )
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        "# 🏅 ATLAS — CATÁLOGO OFICIAL DE MEDALHAS",
        "",
        "Consulte abaixo todas as condecorações atualmente disponíveis no sistema Atlas.",
        "Cada categoria apresenta suas medalhas, requisitos, jurisprudências e responsáveis autorizados para entrega.",
        "-# Exército Brasileiro • Sistema Oficial de Condecorações",
      ].join("\n")
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        "## 📊 Catálogo disponível",
        "",
        `**${categoryCount}** categoria(s) ativa(s)`,
        `**${medalCount}** medalha(s) disponível(is)`,
      ].join("\n")
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        "## 📚 Como consultar",
        "",
        "**01** • Localize a categoria desejada abaixo.",
        "**02** • Consulte as medalhas pertencentes à categoria.",
        "**03** • Verifique os requisitos e a jurisprudência, quando houver.",
        "**04** • Observe os cargos autorizados para a entrega da condecoração.",
        "**05** • Para solicitar uma medalha, utilize o painel oficial de solicitações.",
      ].join("\n")
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        "## ℹ️ Informações importantes",
        "",
        "O catálogo é atualizado pelo Atlas conforme as configurações oficiais das medalhas.",
        "As mensagens abaixo são organizadas por categoria para facilitar a consulta e evitar repetições desnecessárias da apresentação.",
        "",
        `-# Última atualização: ${formatDate(new Date())}`,
      ].join("\n")
    )
  );

  return container;
}

async function upsertCatalogPresentation(
  guild: Guild,
  channel: TextChannel
): Promise<string> {
  const config = await prisma.guildConfig.findUnique({
    where: {
      requestGuildId: guild.id,
    },
  });

  if (!config) {
    throw new Error("O servidor ainda não possui configuração do Atlas.");
  }

  const container = await buildCatalogPresentation(guild);
  const payload = {
    content: null,
    embeds: [],
    components: [container],
    files: [
      {
        attachment: BANNER_PATH,
        name: "catalogo.png",
      },
    ],
    flags: MessageFlags.IsComponentsV2,
  };

  if (config.medalCatalogMessageId) {
    const existing = await channel.messages
      .fetch(config.medalCatalogMessageId)
      .catch(() => null);

    if (existing) {
      await existing.edit(payload);
      return existing.id;
    }
  }

  const message = await channel.send(payload);

  await prisma.guildConfig.update({
    where: {
      requestGuildId: guild.id,
    },
    data: {
      medalCatalogMessageId: message.id,
    },
  });

  return message.id;
}

export async function buildMedalCategoryComponents(
  guild: Guild,
  categoryId: string
): Promise<ContainerBuilder | null> {
  const category = await prisma.medalCategory.findUnique({
    where: {
      id: categoryId,
    },
    include: {
      medals: {
        where: {
          active: true,
        },
        include: {
          deliveryPermissionRoles: {
            select: {
              roleId: true,
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      },
    },
  });

  if (!category || !category.active) {
    return null;
  }

  if (category.medals.length === 0) {
    return null;
  }

  const container = new ContainerBuilder();

  const firstMedalWithColor = category.medals.find(
    (medal) => medal.color
  );

  if (firstMedalWithColor?.color) {
    const color = hexToNumber(firstMedalWithColor.color);

    if (color !== null) {
      container.setAccentColor(color);
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        `# ${category.emoji ?? "🏅"} ${category.name}`,
        "",
        category.description
          ? cleanText(category.description)
          : "### Sistema Oficial de Condecorações",
      ].join("\n")
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small)
  );

  for (let index = 0; index < category.medals.length; index++) {
    const medal = category.medals[index];

    if (!medal) {
      continue;
    }

    const sections: string[] = [];

    sections.push(`## ${medal.emoji ?? "🎖️"} ${medal.name}`);

    sections.push(
      "",
      "**Requisitos**",
      cleanText(medal.requirements)
    );

    if (medal.jurisprudence) {
      sections.push(
        "",
        "**Jurisprudência**",
        cleanText(medal.jurisprudence)
      );
    }

    sections.push(
      "",
      "**Autorização**",
      buildDeliveryPermissionRoles(
        guild,
        medal.deliveryPermissionRoles
      )
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        sections.join("\n")
      )
    );

    if (index < category.medals.length - 1) {
      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small)
      );
    }
  }

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        `-# Atlas • ${category.name}`,
        `-# Última atualização: ${formatDate(new Date())}`,
      ].join("\n")
    )
  );

  return container;
}

export async function createMedalCategoryCatalog(
  guild: Guild,
  categoryId: string
): Promise<string | null> {
  const config = await prisma.guildConfig.findUnique({
    where: {
      requestGuildId: guild.id,
    },
  });

  if (!config?.medalCatalogChannelId) {
    console.error("❌ [CATALOG] Canal do catálogo não configurado.");
    return null;
  }

  const channel = guild.channels.cache.get(
    config.medalCatalogChannelId
  );

  if (!(channel instanceof TextChannel)) {
    console.error("❌ [CATALOG] Canal do catálogo não encontrado.");
    return null;
  }

  const category = await prisma.medalCategory.findUnique({
    where: {
      id: categoryId,
    },
  });

  if (!category || !category.active) {
    return null;
  }

  const container = await buildMedalCategoryComponents(
    guild,
    category.id
  );

  if (!container) {
    return null;
  }

  const message = await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  await prisma.medalCategory.update({
    where: {
      id: category.id,
    },
    data: {
      catalogMessageId: message.id,
    },
  });

  return message.id;
}

export async function updateMedalCategoryCatalog(
  guild: Guild,
  categoryId: string
): Promise<boolean> {
  const config = await prisma.guildConfig.findUnique({
    where: {
      requestGuildId: guild.id,
    },
  });

  if (!config?.medalCatalogChannelId) {
    console.error("❌ [CATALOG] Canal do catálogo não configurado.");
    return false;
  }

  const channel = guild.channels.cache.get(
    config.medalCatalogChannelId
  );

  if (!(channel instanceof TextChannel)) {
    return false;
  }

  const category = await prisma.medalCategory.findUnique({
    where: {
      id: categoryId,
    },
  });

  if (!category) {
    return false;
  }

  const container = await buildMedalCategoryComponents(
    guild,
    category.id
  );

  if (!container) {
    if (category.catalogMessageId) {
      try {
        const oldMessage = await channel.messages.fetch(
          category.catalogMessageId
        );
        await oldMessage.delete();
      } catch {
        // Mensagem já pode ter sido removida.
      }

      await prisma.medalCategory.update({
        where: {
          id: category.id,
        },
        data: {
          catalogMessageId: null,
        },
      });
    }

    return true;
  }

  if (!category.catalogMessageId) {
    const message = await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });

    await prisma.medalCategory.update({
      where: {
        id: category.id,
      },
      data: {
        catalogMessageId: message.id,
      },
    });

    return true;
  }

  try {
    const message = await channel.messages.fetch(
      category.catalogMessageId
    );

    await message.edit({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });

    return true;
  } catch {
    try {
      const message = await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

      await prisma.medalCategory.update({
        where: {
          id: category.id,
        },
        data: {
          catalogMessageId: message.id,
        },
      });

      return true;
    } catch (sendError) {
      console.error(
        "❌ [CATALOG] Erro ao recriar mensagem da categoria:",
        sendError
      );

      return false;
    }
  }
}

export async function syncMedalCatalog(
  guild: Guild
): Promise<boolean> {
  const config = await prisma.guildConfig.findUnique({
    where: {
      requestGuildId: guild.id,
    },
  });

  if (!config?.medalCatalogChannelId) {
    console.error("❌ [CATALOG] Canal do catálogo não configurado.");
    return false;
  }

  const channel = guild.channels.cache.get(
    config.medalCatalogChannelId
  );

  if (!(channel instanceof TextChannel)) {
    console.error("❌ [CATALOG] Canal do catálogo não encontrado.");
    return false;
  }

  await upsertCatalogPresentation(guild, channel);

  const categories = await prisma.medalCategory.findMany({
    orderBy: [
      {
        position: "asc",
      },
      {
        name: "asc",
      },
    ],
  });

  for (const category of categories) {
    await updateMedalCategoryCatalog(guild, category.id);
  }

  for (const category of categories) {
    if (category.active || !category.catalogMessageId) {
      continue;
    }

    try {
      const message = await channel.messages.fetch(
        category.catalogMessageId
      );
      await message.delete();
    } catch {
      // Mensagem já pode ter sido removida.
    }

    await prisma.medalCategory.update({
      where: {
        id: category.id,
      },
      data: {
        catalogMessageId: null,
      },
    });
  }

  console.log("✅ [CATALOG] Catálogo sincronizado com sucesso.");
  return true;
}

export async function createMedalCatalog(
  guild: Guild,
  channelId: string
): Promise<string | null> {
  await prisma.guildConfig.updateMany({
    where: {
      requestGuildId: guild.id,
    },
    data: {
      medalCatalogChannelId: channelId,
    },
  });

  const success = await syncMedalCatalog(guild);

  if (!success) {
    return null;
  }

  const config = await prisma.guildConfig.findUnique({
    where: {
      requestGuildId: guild.id,
    },
  });

  return config?.medalCatalogMessageId ?? null;
}

export async function updateMedalCatalog(
  guild: Guild
): Promise<boolean> {
  return syncMedalCatalog(guild);
}
