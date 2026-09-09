import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
} from "discord.js";

import { logAuditEvent } from "../services/audit-log.service.js";

import {
  createMedalCatalog,
  updateMedalCatalog,
} from "../services/medal-catalog.service.js";

import { prisma } from "../infrastructure/database/prisma.js";

import {
  saveMedalDraft,
  getMedalDraft,
  deleteMedalDraft,
} from "../services/medal-draft.service.js";

export const data = new SlashCommandBuilder()
  .setName("medal")
  .setDescription("Gerencia as medalhas do Atlas.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("criar")
      .setDescription("Cadastra uma nova medalha.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("listar")
      .setDescription("Publica o catálogo de medalhas.")
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  console.log(
    "🟢 [MEDAL] Comando recebido:",
    interaction.commandName,
    interaction.options.getSubcommand()
  );

  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ Este comando só pode ser usado em um servidor.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);

  if (!member.permissions.has("Administrator")) {
    await interaction.reply({
      content: "❌ Apenas administradores podem gerenciar medalhas.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "criar") {
    const config = await prisma.guildConfig.findUnique({
      where: { requestGuildId: interaction.guild.id },
    });

    if (!config) {
      await interaction.reply({
        content: "## ⚙️ Atlas não configurado\n\nEste servidor ainda não possui uma configuração válida.\n\nUse `/setup` antes de cadastrar medalhas.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!config.deliveryGuildId) {
      await interaction.reply({
        content: "## ⚙️ Servidor de entrega não configurado\n\nO Atlas ainda não sabe em qual servidor os cargos das medalhas serão entregues.\n\n-# Um administrador precisa configurar o servidor de entrega pelo `/setup`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    let deliveryGuild;
    try {
      deliveryGuild = await interaction.client.guilds.fetch(config.deliveryGuildId);
    } catch (error) {
      console.error("❌ [MEDAL] Não foi possível acessar o servidor de entrega:", error);
      await interaction.reply({
        content: "## ❌ Servidor de entrega inacessível\n\nO Atlas não conseguiu acessar o servidor configurado para a entrega das medalhas.\n\n-# Verifique se o Atlas ainda está presente nesse servidor.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const categories = await prisma.medalCategory.findMany({
      where: { active: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });

    if (categories.length === 0) {
      await interaction.reply({
        content: "❌ Não existem categorias cadastradas.\n\nCrie uma categoria primeiro usando `/categoria criar`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const modal = new ModalBuilder().setCustomId("medal_create").setTitle("🎖️ Nova medalha");
    const nameInput = new TextInputBuilder().setCustomId("medal_name").setLabel("Nome da medalha").setPlaceholder("Ex.: Militar do Ano").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
    const requirementsInput = new TextInputBuilder().setCustomId("medal_requirements").setLabel("Requisitos").setPlaceholder("Descreva os requisitos necessários para receber a medalha.").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000);
    const jurisprudenceInput = new TextInputBuilder().setCustomId("medal_jurisprudence").setLabel("Jurisprudência").setPlaceholder("Defina como os requisitos devem ser avaliados e aplicados.").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(4000);
    const emojiInput = new TextInputBuilder().setCustomId("medal_emoji").setLabel("Emoji").setPlaceholder("Ex.: 🏆").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(20);
    const colorInput = new TextInputBuilder().setCustomId("medal_color").setLabel("Cor").setPlaceholder("Ex.: #5865F2").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(7);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(requirementsInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(jurisprudenceInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(emojiInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput)
    );

    await interaction.showModal(modal);
    return;
  }

  if (subcommand === "listar") {
    const config = await prisma.guildConfig.findUnique({
      where: { requestGuildId: interaction.guild.id },
    });

    if (!config) {
      await interaction.reply({
        content: "❌ O Atlas ainda não foi configurado neste servidor.\n\nUse `/setup` antes de configurar o catálogo de medalhas.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!config.deliveryGuildId) {
      await interaction.reply({
        content: "❌ O servidor de entrega das medalhas ainda não foi configurado.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (config.medalCatalogMessageId) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const updated = await updateMedalCatalog(interaction.guild);
        await interaction.editReply({
          content: updated
            ? "✅ O catálogo de medalhas já existe e foi atualizado."
            : "⚠️ O catálogo estava configurado, mas não foi possível localizar a mensagem. Será necessário recriá-lo.",
        });
      } catch (error) {
        console.error("❌ Erro ao atualizar catálogo de medalhas:", error);
        await interaction.editReply({
          content: "❌ Ocorreu um erro ao atualizar o catálogo de medalhas.",
        });
      }
      return;
    }

    const catalogChannelId = config.medalCatalogChannelId;
    if (!catalogChannelId) {
      await interaction.reply({
        content: "❌ O canal do catálogo de medalhas ainda não foi configurado.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const messageId = await createMedalCatalog(interaction.guild, catalogChannelId);
      if (!messageId) {
        await interaction.editReply({ content: "❌ Não foi possível acessar o canal configurado para o catálogo." });
        return;
      }
      await interaction.editReply({
        content: "✅ **Catálogo de medalhas publicado com sucesso!**\n\nA partir de agora, o Atlas atualizará essa mensagem automaticamente sempre que houver alterações nas medalhas.",
      });
    } catch (error) {
      console.error("❌ Erro ao criar catálogo de medalhas:", error);
      await interaction.editReply({ content: "❌ Ocorreu um erro ao publicar o catálogo de medalhas." });
    }
  }
}

export async function handleMedalModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId !== "medal_create") return;

  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Este formulário só pode ser utilizado em um servidor.", flags: MessageFlags.Ephemeral });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.permissions.has("Administrator")) {
    await interaction.reply({ content: "❌ Apenas administradores podem criar medalhas.", flags: MessageFlags.Ephemeral });
    return;
  }

  const name = interaction.fields.getTextInputValue("medal_name").trim();
  const requirements = interaction.fields.getTextInputValue("medal_requirements").trim();
  const jurisprudence = interaction.fields.getTextInputValue("medal_jurisprudence").trim() || null;
  const emoji = interaction.fields.getTextInputValue("medal_emoji").trim() || null;
  const color = interaction.fields.getTextInputValue("medal_color").trim() || null;

  if (!name) {
    await interaction.reply({ content: "❌ O nome da medalha não pode ficar vazio.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (!requirements) {
    await interaction.reply({ content: "❌ Os requisitos da medalha não podem ficar vazios.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    await interaction.reply({ content: "❌ A cor informada é inválida.\n\nUse o formato hexadecimal, por exemplo: `#5865F2`.", flags: MessageFlags.Ephemeral });
    return;
  }

  const existingMedal = await prisma.medal.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, active: true },
  });
  if (existingMedal) {
    await interaction.reply({ content: "❌ Já existe uma medalha ativa com esse nome.", flags: MessageFlags.Ephemeral });
    return;
  }

  saveMedalDraft(interaction.user.id, {
    name,
    requirements,
    jurisprudence,
    emoji,
    color,
    deliveryRoleIds: [],
    approvalRoleIds: [],
    deliveryPermissionRoleIds: [],
    categoryId: null,
  });

  const categories = await prisma.medalCategory.findMany({
    where: { active: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

  if (categories.length === 0) {
    deleteMedalDraft(interaction.user.id);
    await interaction.reply({ content: "❌ Não existem categorias disponíveis.\n\nCrie uma categoria primeiro usando `/categoria criar`.", flags: MessageFlags.Ephemeral });
    return;
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`medal_category_select:${interaction.user.id}`)
    .setPlaceholder("Selecione a categoria da medalha")
    .setMinValues(1)
    .setMaxValues(1);

  for (const category of categories.slice(0, 25)) {
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(category.name.slice(0, 100))
      .setValue(category.id);
    if (category.description) option.setDescription(category.description.slice(0, 100));
    if (category.emoji) option.setEmoji(category.emoji);
    selectMenu.addOptions(option);
  }

  await interaction.reply({
    content: "### 🎖️ Categoria da medalha\n\nSelecione abaixo a categoria em que esta medalha será cadastrada.",
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleMedalCategorySelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.customId.startsWith("medal_category_select:")) return;
  const userId = interaction.customId.split(":")[1];
  if (interaction.user.id !== userId) {
    await interaction.reply({ content: "❌ Este menu de seleção pertence a outro administrador.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Esta interação só pode ser utilizada em um servidor.", flags: MessageFlags.Ephemeral });
    return;
  }

  const draft = getMedalDraft(interaction.user.id);
  if (!draft) {
    await interaction.update({ content: "❌ Os dados da medalha expiraram. Inicie o cadastro novamente usando `/medal criar`.", components: [] });
    return;
  }
  const categoryId = interaction.values[0];
  if (!categoryId) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Nenhuma categoria foi selecionada.", components: [] });
    return;
  }
  const category = await prisma.medalCategory.findUnique({ where: { id: categoryId } });
  if (!category || !category.active) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ A categoria selecionada não está mais disponível.", components: [] });
    return;
  }
  draft.categoryId = category.id;

  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: interaction.guild.id } });
  if (!config?.deliveryGuildId) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ O servidor de entrega não está configurado.", components: [] });
    return;
  }

  let deliveryGuild;
  try {
    deliveryGuild = await interaction.client.guilds.fetch(config.deliveryGuildId);
  } catch (error) {
    console.error("❌ [MEDAL] Erro ao buscar servidor de entrega:", error);
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Não foi possível acessar o servidor de entrega.", components: [] });
    return;
  }

  let roles;
  try {
    roles = await deliveryGuild.roles.fetch();
  } catch (error) {
    console.error("❌ [MEDAL] Erro ao buscar cargos:", error);
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Não foi possível consultar os cargos do servidor de entrega.", components: [] });
    return;
  }

  const availableRoles = roles.filter((role) => role.id !== deliveryGuild.id && !role.managed).sort((a, b) => b.position - a.position);
  if (availableRoles.size === 0) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Nenhum cargo disponível no servidor de entrega.", components: [] });
    return;
  }

  const rolesForSelect = availableRoles.first(25);
  const roleSelect = new StringSelectMenuBuilder()
    .setCustomId(`medal_delivery_roles:${interaction.user.id}`)
    .setPlaceholder("Selecione os cargos que serão entregues")
    .setMinValues(1)
    .setMaxValues(Math.min(rolesForSelect.length, 10));

  for (const role of rolesForSelect) {
    roleSelect.addOptions(new StringSelectMenuOptionBuilder().setLabel(role.name.slice(0, 100)).setValue(role.id).setDescription(`Cargo do servidor ${deliveryGuild.name}`.slice(0, 100)));
  }

  await interaction.update({
    content: [
      "### 🎖️ Cargos de entrega",
      "",
      `🎖️ **Medalha:** ${draft.name}`,
      `🗂️ **Categoria:** ${category.name}`,
      `🏰 **Servidor de entrega:** ${deliveryGuild.name}`,
      "",
      "Selecione os cargos que o Atlas deverá **conceder ao usuário** quando esta medalha for efetivamente entregue.",
      "",
      "-# Estes cargos são independentes dos cargos autorizados a aprovar ou entregar a medalha.",
    ].join("\n"),
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect)],
  });
}

export async function handleMedalDeliveryRoleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.customId.startsWith("medal_delivery_roles:")) return;
  const userId = interaction.customId.split(":")[1];
  if (interaction.user.id !== userId) {
    await interaction.reply({ content: "❌ Este menu de seleção pertence a outro administrador.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Esta interação só pode ser utilizada em um servidor.", flags: MessageFlags.Ephemeral });
    return;
  }
  const draft = getMedalDraft(interaction.user.id);
  if (!draft) {
    await interaction.update({ content: "❌ Os dados da medalha expiraram. Inicie o cadastro novamente usando `/medal criar`.", components: [] });
    return;
  }
  if (!draft.categoryId) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ A categoria da medalha não foi definida. Inicie o cadastro novamente.", components: [] });
    return;
  }
  const roleIds = interaction.values;
  if (roleIds.length === 0) {
    await interaction.reply({ content: "❌ Selecione pelo menos um cargo de entrega.", flags: MessageFlags.Ephemeral });
    return;
  }
  draft.deliveryRoleIds = roleIds;

  let requestRoles;
  try {
    requestRoles = await interaction.guild.roles.fetch();
  } catch (error) {
    console.error("❌ [MEDAL] Não foi possível buscar os cargos do servidor de solicitação:", error);
    await interaction.update({ content: "❌ Não foi possível consultar os cargos do servidor.", components: [] });
    return;
  }
  const availableApprovalRoles = requestRoles.filter((role) => role.id !== interaction.guild!.id && !role.managed).sort((a, b) => b.position - a.position);
  if (availableApprovalRoles.size === 0) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "## ❌ Nenhum cargo disponível\n\nNão existem cargos válidos neste servidor que possam ser configurados como autorizados a aprovar ou negar esta medalha.", components: [] });
    return;
  }
  const approvalRolesForSelect = availableApprovalRoles.first(25);
  const approvalRoleSelect = new StringSelectMenuBuilder().setCustomId(`medal_approval_roles:${interaction.user.id}`).setPlaceholder("Selecione quem poderá aprovar ou negar").setMinValues(1).setMaxValues(Math.min(approvalRolesForSelect.length, 10));
  for (const role of approvalRolesForSelect) {
    approvalRoleSelect.addOptions(new StringSelectMenuOptionBuilder().setLabel(role.name.slice(0, 100)).setValue(role.id).setDescription("Pode aprovar ou negar esta medalha."));
  }
  await interaction.update({
    content: [
      "### 🛡️ Cargos autorizados para análise",
      "",
      `🎖️ **Medalha:** ${draft.name}`,
      "",
      "Agora selecione os cargos que terão autorização para **aprovar ou negar esta medalha** durante a análise dos tickets.",
      "",
      "-# A equipe responsável pelos tickets não recebe essa permissão automaticamente.",
      "-# Apenas os cargos selecionados aqui poderão decidir esta medalha.",
    ].join("\n"),
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(approvalRoleSelect)],
  });
}

export async function handleMedalApprovalRoleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.customId.startsWith("medal_approval_roles:")) return;
  const userId = interaction.customId.split(":")[1];
  if (interaction.user.id !== userId) {
    await interaction.reply({ content: "❌ Este menu de seleção pertence a outro administrador.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Esta interação só pode ser utilizada em um servidor.", flags: MessageFlags.Ephemeral });
    return;
  }
  const draft = getMedalDraft(interaction.user.id);
  if (!draft) {
    await interaction.update({ content: "❌ Os dados da medalha expiraram. Inicie o cadastro novamente usando `/medal criar`.", components: [] });
    return;
  }
  if (!draft.categoryId) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ A categoria da medalha não foi definida.", components: [] });
    return;
  }
  if (draft.deliveryRoleIds.length === 0) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Os cargos de entrega não foram definidos.", components: [] });
    return;
  }
  const approvalRoleIds = interaction.values;
  if (approvalRoleIds.length === 0) {
    await interaction.reply({ content: "❌ Selecione pelo menos um cargo autorizado.", flags: MessageFlags.Ephemeral });
    return;
  }
  draft.approvalRoleIds = approvalRoleIds;

  const category = await prisma.medalCategory.findUnique({ where: { id: draft.categoryId } });
  if (!category || !category.active) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ A categoria selecionada não está mais disponível.", components: [] });
    return;
  }
  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: interaction.guild.id } });
  if (!config?.deliveryGuildId) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ O servidor de entrega não está configurado.", components: [] });
    return;
  }

  let deliveryGuild;
  try {
    deliveryGuild = await interaction.client.guilds.fetch(config.deliveryGuildId);
  } catch (error) {
    console.error("❌ [MEDAL] Não foi possível acessar o servidor de entrega:", error);
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Não foi possível acessar o servidor de entrega.", components: [] });
    return;
  }

  let deliveryRoles;
  try {
    deliveryRoles = await deliveryGuild.roles.fetch();
  } catch (error) {
    console.error("❌ [MEDAL] Não foi possível buscar os cargos do servidor de entrega:", error);
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Não foi possível consultar os cargos do servidor de entrega.", components: [] });
    return;
  }
  const selectedDeliveryRoles = draft.deliveryRoleIds.map((roleId) => deliveryRoles.get(roleId));
  if (selectedDeliveryRoles.some((role) => !role || role.managed)) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Um ou mais cargos de entrega não existem mais ou são cargos gerenciados.", components: [] });
    return;
  }
  const requestRoles = await interaction.guild.roles.fetch();
  const selectedApprovalRoles = approvalRoleIds.map((roleId) => requestRoles.get(roleId));
  if (selectedApprovalRoles.some((role) => !role || role.managed)) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Um ou mais cargos de aprovação não existem mais ou são cargos gerenciados.", components: [] });
    return;
  }
  const availableDeliveryPermissionRoles = requestRoles.filter((role) => role.id !== interaction.guild!.id && !role.managed).sort((a, b) => b.position - a.position);
  if (availableDeliveryPermissionRoles.size === 0) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "## ❌ Nenhum cargo disponível\n\nNão existem cargos válidos neste servidor que possam ser configurados como autorizados a realizar a entrega desta medalha.", components: [] });
    return;
  }
  const deliveryPermissionRolesForSelect = availableDeliveryPermissionRoles.first(25);
  const deliveryPermissionRoleSelect = new StringSelectMenuBuilder().setCustomId(`medal_delivery_permission_roles:${interaction.user.id}`).setPlaceholder("Selecione quem poderá entregar").setMinValues(1).setMaxValues(Math.min(deliveryPermissionRolesForSelect.length, 10));
  for (const role of deliveryPermissionRolesForSelect) {
    deliveryPermissionRoleSelect.addOptions(new StringSelectMenuOptionBuilder().setLabel(role.name.slice(0, 100)).setValue(role.id).setDescription("Pode aceitar e realizar a entrega desta medalha."));
  }
  await interaction.update({
    content: [
      "### 🪖 Cargos autorizados para entrega",
      "",
      `🎖️ **Medalha:** ${draft.name}`,
      `🗂️ **Categoria:** ${category.name}`,
      "",
      "Agora selecione os cargos que terão autorização para **aceitar e realizar a entrega desta medalha**.",
      "",
      "### 🔐 Como funciona",
      "",
      "⚖️ **Aprovação:** decide se a medalha será concedida.",
      "🪖 **Entrega:** pessoa autorizada executa a entrega efetiva no servidor EB.",
      "🎖️ **Cargo concedido:** é o cargo que o militar receberá quando a entrega for concluída.",
      "",
      "-# A aprovação e a entrega são etapas diferentes.",
      "-# Os cargos de entrega não recebem autorização automaticamente por serem da equipe.",
    ].join("\n"),
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(deliveryPermissionRoleSelect)],
  });
}

export async function handleMedalDeliveryPermissionRoleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.customId.startsWith("medal_delivery_permission_roles:")) return;
  const userId = interaction.customId.split(":")[1];
  if (interaction.user.id !== userId) {
    await interaction.reply({ content: "❌ Este menu de seleção pertence a outro administrador.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Esta interação só pode ser utilizada em um servidor.", flags: MessageFlags.Ephemeral });
    return;
  }
  const draft = getMedalDraft(interaction.user.id);
  if (!draft) {
    await interaction.update({ content: "❌ Os dados da medalha expiraram. Inicie o cadastro novamente usando `/medal criar`.", components: [] });
    return;
  }
  if (!draft.categoryId) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ A categoria da medalha não foi definida.", components: [] });
    return;
  }
  if (draft.deliveryRoleIds.length === 0) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Os cargos concedidos pela medalha não foram definidos.", components: [] });
    return;
  }
  if (draft.approvalRoleIds.length === 0) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Os cargos autorizados a aprovar ou negar não foram definidos.", components: [] });
    return;
  }
  const deliveryPermissionRoleIds = interaction.values;
  if (deliveryPermissionRoleIds.length === 0) {
    await interaction.reply({ content: "❌ Selecione pelo menos um cargo autorizado a realizar a entrega.", flags: MessageFlags.Ephemeral });
    return;
  }
  draft.deliveryPermissionRoleIds = deliveryPermissionRoleIds;

  const category = await prisma.medalCategory.findUnique({ where: { id: draft.categoryId } });
  if (!category || !category.active) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ A categoria selecionada não está mais disponível.", components: [] });
    return;
  }
  const config = await prisma.guildConfig.findUnique({ where: { requestGuildId: interaction.guild.id } });
  if (!config?.deliveryGuildId) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ O servidor de entrega não está configurado.", components: [] });
    return;
  }

  let deliveryGuild;
  try {
    deliveryGuild = await interaction.client.guilds.fetch(config.deliveryGuildId);
  } catch (error) {
    console.error("❌ [MEDAL] Não foi possível acessar o servidor de entrega:", error);
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Não foi possível acessar o servidor de entrega.", components: [] });
    return;
  }
  let deliveryRoles;
  try {
    deliveryRoles = await deliveryGuild.roles.fetch();
  } catch (error) {
    console.error("❌ [MEDAL] Não foi possível buscar os cargos do servidor de entrega:", error);
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Não foi possível consultar os cargos do servidor de entrega.", components: [] });
    return;
  }
  const selectedDeliveryRoles = draft.deliveryRoleIds.map((roleId) => deliveryRoles.get(roleId));
  if (selectedDeliveryRoles.some((role) => !role || role.managed)) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Um ou mais cargos que serão concedidos pela medalha não existem mais ou são cargos gerenciados.", components: [] });
    return;
  }
  const requestRoles = await interaction.guild.roles.fetch();
  const selectedApprovalRoles = draft.approvalRoleIds.map((roleId) => requestRoles.get(roleId));
  if (selectedApprovalRoles.some((role) => !role || role.managed)) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Um ou mais cargos de aprovação não existem mais ou são cargos gerenciados.", components: [] });
    return;
  }
  const selectedDeliveryPermissionRoles = draft.deliveryPermissionRoleIds.map((roleId) => requestRoles.get(roleId));
  if (selectedDeliveryPermissionRoles.some((role) => !role || role.managed)) {
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Um ou mais cargos autorizados a realizar a entrega não existem mais ou são cargos gerenciados.", components: [] });
    return;
  }

  try {
    const medal = await prisma.medal.create({
      data: {
        name: draft.name,
        requirements: draft.requirements,
        jurisprudence: draft.jurisprudence,
        emoji: draft.emoji,
        color: draft.color,
        categoryId: draft.categoryId,
      },
    });

    await prisma.medalRole.createMany({
      data: draft.deliveryRoleIds.map((roleId) => ({ medalId: medal.id, roleId })),
      skipDuplicates: true,
    });
    await prisma.medalApprovalRole.createMany({
      data: draft.approvalRoleIds.map((roleId) => ({ medalId: medal.id, roleId })),
      skipDuplicates: true,
    });
    await prisma.medalDeliveryPermissionRole.createMany({
      data: draft.deliveryPermissionRoleIds.map((roleId) => ({ medalId: medal.id, roleId })),
      skipDuplicates: true,
    });

    await logAuditEvent({
      guild: interaction.guild,
      action: "MEDAL_CREATED",
      executorId: interaction.user.id,
      medalId: medal.id,
      details: {
        name: medal.name,
        categoryId: category.id,
        categoryName: category.name,
        deliveryGuildId: deliveryGuild.id,
        deliveryGuildName: deliveryGuild.name,
        deliveryRoleIds: draft.deliveryRoleIds,
        deliveryRoleNames: selectedDeliveryRoles.filter((role): role is NonNullable<typeof role> => Boolean(role)).map((role) => role.name),
        approvalRoleIds: draft.approvalRoleIds,
        approvalRoleNames: selectedApprovalRoles.filter((role): role is NonNullable<typeof role> => Boolean(role)).map((role) => role.name),
        deliveryPermissionRoleIds: draft.deliveryPermissionRoleIds,
        deliveryPermissionRoleNames: selectedDeliveryPermissionRoles.filter((role): role is NonNullable<typeof role> => Boolean(role)).map((role) => role.name),
      },
    });

    await updateMedalCatalog(interaction.guild);
    deleteMedalDraft(interaction.user.id);

    const deliveryRoleMentions = draft.deliveryRoleIds.map((roleId) => `<@&${roleId}>`).join("\n");
    const approvalRoleMentions = draft.approvalRoleIds.map((roleId) => `<@&${roleId}>`).join("\n");
    const deliveryPermissionRoleMentions = draft.deliveryPermissionRoleIds.map((roleId) => `<@&${roleId}>`).join("\n");

    await interaction.update({
      content: [
        "## ✅ Medalha cadastrada com sucesso!",
        "",
        `🎖️ **${medal.name}**`,
        `🗂️ **Categoria:** ${category.name}`,
        `🏰 **Servidor de entrega:** ${deliveryGuild.name}`,
        "",
        medal.emoji ? `✨ **Emoji:** ${medal.emoji}` : "",
        medal.color ? `🎨 **Cor:** \`${medal.color}\`` : "",
        "",
        "🎁 **Cargos concedidos ao militar:**",
        deliveryRoleMentions,
        "",
        "⚖️ **Cargos autorizados a aprovar/negar:**",
        approvalRoleMentions,
        "",
        "🪖 **Cargos autorizados a realizar a entrega:**",
        deliveryPermissionRoleMentions,
        "",
        "-# Os cargos concedidos ao militar só serão atribuídos quando a medalha for efetivamente entregue.",
        "-# Os cargos de aprovação são responsáveis apenas pela decisão de aprovar ou negar.",
        "-# Os cargos de entrega são responsáveis pela etapa posterior de entrega efetiva.",
        "-# Aprovação e entrega são etapas distintas do fluxo.",
      ].filter(Boolean).join("\n"),
      components: [],
    });
  } catch (error) {
    console.error("❌ [MEDAL] Erro ao criar medalha:", error);
    deleteMedalDraft(interaction.user.id);
    await interaction.update({ content: "❌ Ocorreu um erro ao cadastrar a medalha. Nenhuma alteração foi realizada.", components: [] });
  }
}
