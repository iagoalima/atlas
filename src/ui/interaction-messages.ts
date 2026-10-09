import {
  ContainerBuilder,
  Interaction,
  MessageFlags,
  TextDisplayBuilder,
} from "discord.js";

import { colors } from "./colors.js";
import {
  replaceAnimatedEmojis,
  replaceAnimatedEmojisInComponents,
} from "./animated-emojis.js";

const STYLE_WRAPPED = Symbol("atlasInteractionMessageStyleWrapped");

type MessageMethod =
  | "reply"
  | "update"
  | "editReply"
  | "followUp"
  | "deferReply";

const PUBLIC_MESSAGE_HEADERS = [
  "## 🔒 Ticket encerrado",
  "## 🏅 Medalha entregue",
  "## ❌ Medalha negada",
  "## 🗑️ Ticket excluído",
  "## ⚠️ Aprovação registrada",
  "## 🔒 Ticket encerrado forçadamente",
] as const;

function getAccentColor(content: string): number {
  if (content.includes("❌")) {
    return colors.danger;
  }

  if (content.includes("⚠️")) {
    return colors.warning;
  }

  if (content.includes("✅") || content.includes("🟢")) {
    return colors.success;
  }

  if (
    content.includes("🏅") ||
    content.includes("🎖️") ||
    content.includes("🏆")
  ) {
    return 0xf1c40f;
  }

  return colors.primary;
}

function buildContainer(content: string): ContainerBuilder {
  const normalized = replaceAnimatedEmojis(content.trim());
  const lines = normalized.split("\n");

  const firstBlankLine = lines.indexOf("");
  const headerEnd =
    firstBlankLine > 0 ? firstBlankLine : 1;

  const header = lines.slice(0, headerEnd).join("\n").trim();
  const body = lines.slice(headerEnd).join("\n").trim();

  const container = new ContainerBuilder().setAccentColor(
    getAccentColor(content)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(header || normalized)
  );

  if (body) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(body)
    );
  }

  return container;
}

function hasComponentsV2(flags: unknown): boolean {
  return (
    typeof flags === "number" &&
    (flags & MessageFlags.IsComponentsV2) === MessageFlags.IsComponentsV2
  );
}

function isPublicMessageContent(content: string | null): boolean {
  if (!content) {
    return false;
  }

  const normalized = content.trim();

  return PUBLIC_MESSAGE_HEADERS.some(
    (header) =>
      normalized === header ||
      normalized.startsWith(`${header}\n`)
  );
}

function isPublicInteraction(
  customId: string | undefined
): boolean {
  if (!customId) {
    return false;
  }

  return (
    customId === "ticket_close" ||
    customId.startsWith("ticket_medal_deliver:")
  );
}

function removeEphemeralFlag(flags: unknown): unknown {
  if (typeof flags !== "number") {
    return flags;
  }

  return flags & ~MessageFlags.Ephemeral;
}

function normalizeMessagePayload(
  payload: unknown,
  customId?: string
): unknown {
  const forcePublic = isPublicInteraction(customId);

  if (typeof payload === "string") {
    return {
      flags: MessageFlags.IsComponentsV2,
      components: [buildContainer(payload)],
    };
  }

  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const options = payload as Record<string, unknown>;

  const content =
    typeof options.content === "string"
      ? options.content
      : null;

  const shouldBePublic =
    forcePublic ||
    isPublicMessageContent(content);

  const normalizedFlags = shouldBePublic
    ? removeEphemeralFlag(options.flags)
    : options.flags;

  if (hasComponentsV2(normalizedFlags)) {
    return {
      ...options,
      content:
        typeof options.content === "string"
          ? replaceAnimatedEmojis(options.content)
          : options.content,
      components:
        replaceAnimatedEmojisInComponents(
          options.components
        ),
      flags: normalizedFlags,
    };
  }

  const existingComponents = Array.isArray(options.components)
    ? options.components
    : [];

  const hasVisibleMessage =
    Boolean(content?.trim()) || existingComponents.length > 0;

  if (!hasVisibleMessage) {
    if (!shouldBePublic) {
      return payload;
    }

    return {
      ...options,
      flags: normalizedFlags,
    };
  }

  const container = content
    ? buildContainer(content)
    : new ContainerBuilder().setAccentColor(colors.primary);

  for (const component of existingComponents) {
    if (!component) {
      continue;
    }

    const componentRecord =
      typeof component === "object"
        ? (component as Record<string, unknown>)
        : {};
    const toJSON = componentRecord.toJSON;
    const serialized =
      typeof toJSON === "function" ? toJSON.call(component) : componentRecord;
    const serializedRecord =
      typeof serialized === "object" && serialized !== null
        ? (serialized as Record<string, unknown>)
        : {};
    const type = serializedRecord.type;

    if (type === 1) {
      container.addActionRowComponents(component as never);
      continue;
    }

    if (type === 14) {
      container.addSeparatorComponents(component as never);
      continue;
    }

    if (type === 10) {
      const jsonRecord =
        typeof serialized === "object" && serialized !== null
          ? (serialized as Record<string, unknown>)
          : {};
      const textContent =
        typeof jsonRecord.content === "string" ? jsonRecord.content : "";

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(replaceAnimatedEmojis(textContent))
      );
      continue;
    }

    if (type === 17) {
      return {
        ...options,
        content: null,
        components:
          replaceAnimatedEmojisInComponents(
            options.components
          ),
        flags:
          (typeof normalizedFlags === "number"
            ? normalizedFlags
            : 0) | MessageFlags.IsComponentsV2,
      };
    }
  }

  const excludedKeys = new Set(["content", "embeds", "stickers", "poll", "components"]);
  const rest = Object.fromEntries(
    Object.entries(options).filter(([key]) => !excludedKeys.has(key)),
  );

  return {
    ...rest,
    content: undefined,
    components: [container],
    flags:
      (typeof normalizedFlags === "number"
        ? normalizedFlags
        : 0) | MessageFlags.IsComponentsV2,
  };
}

export function installInteractionMessageStyle(
  interaction: Interaction
): void {
  const target = interaction as unknown as Record<PropertyKey, unknown>;

  if (target[STYLE_WRAPPED]) return;

  Object.defineProperty(target, STYLE_WRAPPED, {
    value: true,
    enumerable: false,
    configurable: false,
  });

  const methods: MessageMethod[] = [
    "reply",
    "update",
    "editReply",
    "followUp",
    "deferReply",
  ];

  for (const method of methods) {
    const candidate = target[method];
    if (typeof candidate !== "function") continue;

    const original = candidate.bind(target) as (
      ...args: unknown[]
    ) => unknown;

    target[method] = (
      payload: unknown,
      ...rest: unknown[]
    ): unknown => {
      const customId =
        typeof target.customId === "string" ? target.customId : undefined;
      const normalizedPayload = normalizeMessagePayload(payload, customId);

      if (method === "reply") {
        if (target.deferred === true) {
          const editReply = target.editReply;
          if (typeof editReply === "function") {
            return editReply.call(target, normalizedPayload, ...rest);
          }
        }

        if (target.replied === true) {
          const followUp = target.followUp;
          if (typeof followUp === "function") {
            return followUp.call(target, normalizedPayload, ...rest);
          }
        }
      }

      return original(normalizedPayload, ...rest);
    };
  }
}
