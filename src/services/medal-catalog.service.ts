import {
  ContainerBuilder,
  Guild,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextChannel,
  TextDisplayBuilder,
} from "discord.js";

import { prisma } from "../infrastructure/database/prisma.js";

// ==========================================================
// FORMATA DATA
// ==========================================================

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

// ==========================================================
// LIMPA TEXTO
// ==========================================================

function cleanText(text: string): string {
  return text.trim();
}

// ==========================================================
// OBTÉM MENÇÕES DOS CARGOS DE APROVAÇÃO
// ==========================================================

function buildApprovalRoles(
  guild: Guild,
  roles: { roleId: string }[]
): string {
  if (roles.length === 0) {
    return "_Nenhum cargo de aprovação configurado._";
  }

  const mentions = roles
    .map(({ roleId }) => {
      const role = guild.roles.cache.get(roleId);

      if (!role) {
        return `\`Cargo não encontrado: ${roleId}\``;
      }

      return `<@&${role.id}>`;
    })
    .join(" • ");

  return mentions;
}

// ==========================================================
// CONSTRÓI COMPONENTES DE UMA CATEGORIA
// ==========================================================

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
          approvalRoles: {
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

  // ========================================================
  // CONTAINER PRINCIPAL
  // ========================================================

  const container = new ContainerBuilder();

  // ========================================================
  // COR DE DESTAQUE
  // ========================================================

  const firstMedalWithColor = category.medals.find(
  (medal) => medal.color
);

if (firstMedalWithColor?.color) {
  const color = hexToNumber(
    firstMedalWithColor.color
  );

  if (color !== null) {
    container.setAccentColor(color);
  }
}

// ==========================================================
// CONVERTE COR HEX PARA NÚMERO
// ==========================================================

function hexToNumber(hex: string): number | null {
  const normalized = hex.replace("#", "").trim();

  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
    return null;
  }

  return parseInt(normalized, 16);
}

  // ========================================================
  // CABEÇALHO DA CATEGORIA
  // ========================================================

  const categoryTitle = new TextDisplayBuilder().setContent(
    [
      `# ${category.emoji ?? "🏅"} ${category.name}`,
      "",
      category.description
        ? cleanText(category.description)
        : "### Sistema Oficial de Condecorações",
    ].join("\n")
  );

  container.addTextDisplayComponents(categoryTitle);

  // ========================================================
  // SEPARADOR
  // ========================================================

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small)
  );

  // ========================================================
  // MEDALHAS
  // ========================================================

  for (let index = 0; index < category.medals.length; index++) {
  const medal = category.medals[index];

  if (!medal) {
    continue;
  }

  const sections: string[] = [];

    // ======================================================
    // NOME
    // ======================================================

    sections.push(
      `## ${medal.emoji ?? "🎖️"} ${medal.name}`
    );

    // ======================================================
    // REQUISITOS
    // ======================================================

    sections.push(
      "",
      "**Requisitos**",
      cleanText(medal.requirements)
    );

    // ======================================================
    // JURISPRUDÊNCIA
    // ======================================================

    if (medal.jurisprudence) {
      sections.push(
        "",
        "**Jurisprudência**",
        cleanText(medal.jurisprudence)
      );
    }

    // ======================================================
    // CARGOS DE APROVAÇÃO
    // ======================================================

    sections.push(
      "",
      "**Autorização**",
      buildApprovalRoles(
        guild,
        medal.approvalRoles
      )
    );

    // ======================================================
    // ADICIONA MEDALHA
    // ======================================================

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        sections.join("\n")
      )
    );

    // ======================================================
    // SEPARADOR ENTRE MEDALHAS
    // ======================================================

    if (index < category.medals.length - 1) {
      container.addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small)
      );
    }
  }

  // ========================================================
  // RODAPÉ
  // ========================================================

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        `-# Atlas • Catálogo Oficial de Medalhas`,
        `-# Última atualização: ${formatDate(new Date())}`,
      ].join("\n")
    )
  );

  return container;
}

// ==========================================================
// CRIA MENSAGEM DA CATEGORIA
// ==========================================================

export async function createMedalCategoryCatalog(
  guild: Guild,
  categoryId: string
): Promise<string | null> {
  // ========================================================
  // BUSCA CONFIGURAÇÃO
  // ========================================================

  const config = await prisma.guildConfig.findUnique({
    where: {
      requestGuildId: guild.id,
    },
  });

  if (!config?.medalCatalogChannelId) {
    console.error(
      "❌ [CATALOG] Canal do catálogo não configurado."
    );

    return null;
  }

  // ========================================================
  // BUSCA CANAL
  // ========================================================

  const channel = guild.channels.cache.get(
    config.medalCatalogChannelId
  );

  if (!channel || !channel.isTextBased()) {
    console.error(
      "❌ [CATALOG] Canal do catálogo não encontrado."
    );

    return null;
  }

  if (!(channel instanceof TextChannel)) {
    console.error(
      "❌ [CATALOG] O canal configurado não é um canal de texto."
    );

    return null;
  }

  // ========================================================
  // BUSCA CATEGORIA
  // ========================================================

  const category = await prisma.medalCategory.findUnique({
    where: {
      id: categoryId,
    },
  });

  if (!category || !category.active) {
    return null;
  }

  // ========================================================
  // CONSTRÓI COMPONENTES
  // ========================================================

  const container =
    await buildMedalCategoryComponents(
      guild,
      category.id
    );

  if (!container) {
    return null;
  }

  // ========================================================
  // ENVIA MENSAGEM
  // ========================================================

  const message = await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  // ========================================================
  // SALVA ID DA MENSAGEM
  // ========================================================

  await prisma.medalCategory.update({
    where: {
      id: category.id,
    },
    data: {
      catalogMessageId: message.id,
    },
  });

  console.log(
    `✅ [CATALOG] Categoria "${category.name}" publicada.`
  );

  return message.id;
}

// ==========================================================
// ATUALIZA MENSAGEM DA CATEGORIA
// ==========================================================

export async function updateMedalCategoryCatalog(
  guild: Guild,
  categoryId: string
): Promise<boolean> {
  // ========================================================
  // BUSCA CONFIGURAÇÃO
  // ========================================================

  const config = await prisma.guildConfig.findUnique({
    where: {
      requestGuildId: guild.id,
    },
  });

  if (!config?.medalCatalogChannelId) {
    console.error(
      "❌ [CATALOG] Canal do catálogo não configurado."
    );

    return false;
  }

  // ========================================================
  // BUSCA CANAL
  // ========================================================

  const channel = guild.channels.cache.get(
    config.medalCatalogChannelId
  );

  if (!channel || !channel.isTextBased()) {
    return false;
  }

  if (!(channel instanceof TextChannel)) {
    return false;
  }

  // ========================================================
  // BUSCA CATEGORIA
  // ========================================================

  const category = await prisma.medalCategory.findUnique({
    where: {
      id: categoryId,
    },
  });

  if (!category) {
    return false;
  }

  // ========================================================
  // CATEGORIA SEM MEDALHAS
  // ========================================================

  const container =
    await buildMedalCategoryComponents(
      guild,
      category.id
    );

  // ========================================================
  // SE NÃO HÁ MEDALHAS
  // ========================================================

  if (!container) {
    if (category.catalogMessageId) {
      try {
        const oldMessage = await channel.messages.fetch(
          category.catalogMessageId
        );

        await oldMessage.delete();
      } catch (error) {
        console.warn(
          "⚠️ [CATALOG] Não foi possível remover a mensagem antiga da categoria:",
          error
        );
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

  // ========================================================
  // SE NÃO EXISTE MENSAGEM, CRIA
  // ========================================================

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

    console.log(
      `✅ [CATALOG] Mensagem criada para a categoria "${category.name}".`
    );

    return true;
  }

  // ========================================================
  // ATUALIZA MENSAGEM EXISTENTE
  // ========================================================

  try {
    const message = await channel.messages.fetch(
      category.catalogMessageId
    );

    await message.edit({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });

    console.log(
      `✅ [CATALOG] Categoria "${category.name}" atualizada.`
    );

    return true;
  } catch (error) {
    console.warn(
      `⚠️ [CATALOG] Mensagem da categoria "${category.name}" não encontrada. Criando uma nova...`,
      error
    );

    // ======================================================
    // MENSAGEM NÃO EXISTE MAIS
    // ======================================================

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

      console.log(
        `✅ [CATALOG] Nova mensagem criada para "${category.name}".`
      );

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

// ==========================================================
// SINCRONIZA TODO O CATÁLOGO
// ==========================================================

export async function syncMedalCatalog(
  guild: Guild
): Promise<boolean> {
  // ========================================================
  // BUSCA CONFIGURAÇÃO
  // ========================================================

  const config = await prisma.guildConfig.findUnique({
    where: {
      requestGuildId: guild.id,
    },
  });

  if (!config?.medalCatalogChannelId) {
    console.error(
      "❌ [CATALOG] Canal do catálogo não configurado."
    );

    return false;
  }

  // ========================================================
  // BUSCA TODAS AS CATEGORIAS
  // ========================================================

  const categories =
    await prisma.medalCategory.findMany({
      orderBy: [
        {
          position: "asc",
        },
        {
          name: "asc",
        },
      ],
    });

  // ========================================================
  // ATUALIZA / CRIA CADA CATEGORIA
  // ========================================================

  for (const category of categories) {
    await updateMedalCategoryCatalog(
      guild,
      category.id
    );
  }

  // ========================================================
  // REMOVE MENSAGENS DE CATEGORIAS DESATIVADAS
  // ========================================================

  const channel = guild.channels.cache.get(
    config.medalCatalogChannelId
  );

  if (channel instanceof TextChannel) {
    for (const category of categories) {
      if (category.active) {
        continue;
      }

      if (!category.catalogMessageId) {
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
  }

  console.log(
    "✅ [CATALOG] Catálogo sincronizado com sucesso."
  );

  return true;
}

// ==========================================================
// COMPATIBILIDADE
// ==========================================================
// Mantemos estas funções para facilitar a transição do código
// existente.
//
// A partir de agora, o catálogo é sincronizado por categoria.

// ==========================================================
// CRIA CATÁLOGO
// ==========================================================

export async function createMedalCatalog(
  guild: Guild,
  channelId: string
): Promise<string | null> {
  // ========================================================
  // GARANTE QUE O CANAL ESTÁ CONFIGURADO
  // ========================================================

  await prisma.guildConfig.updateMany({
    where: {
      requestGuildId: guild.id,
    },
    data: {
      medalCatalogChannelId: channelId,
    },
  });

  // ========================================================
  // SINCRONIZA CATEGORIAS
  // ========================================================

  const success = await syncMedalCatalog(guild);

  if (!success) {
    return null;
  }

  // ========================================================
  // RETORNA PRIMEIRA MENSAGEM
  // ========================================================

  const firstCategory =
    await prisma.medalCategory.findFirst({
      where: {
        active: true,
        catalogMessageId: {
          not: null,
        },
      },
      orderBy: [
        {
          position: "asc",
        },
        {
          name: "asc",
        },
      ],
    });

  return firstCategory?.catalogMessageId ?? null;
}

// ==========================================================
// ATUALIZA CATÁLOGO
// ==========================================================

export async function updateMedalCatalog(
  guild: Guild
): Promise<boolean> {
  return syncMedalCatalog(guild);
}