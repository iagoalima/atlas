import {
  ContainerBuilder,
  Interaction,
  MessageFlags,
  TextDisplayBuilder,
} from "discord.js";

import { colors } from "./colors.js";

const STYLE_WRAPPED = Symbol("atlasInteractionMessageStyleWrapped");

type MessageMethod =
  | "reply"
  | "update"
  | "editReply"
  | "followUp";

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
  const normalized = content.trim();
  const lines = normalized.split("\n");

  const firstBlankLine = lines.indexOf("");
  const headerEnd =
    firstBlankLine > 0 ? firstBlankLine : 1;

  const header = lines.slice(0, headerEnd).join("\n").trim();
  const body = lines.slice(headerEnd).join("\n").trim();

  const container = new ContainerBuilder().setAccentColor(
    getAccentColor(normalized)
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

function normalizeMessagePayload(payload: unknown): unknown {
  if (typeof payload === "string") {
    return {
      flags: MessageFlags.IsComponentsV2,
      components: [buildContainer(payload)],
    };
  }

  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const options = payload as Record<string, any>;

  if (hasComponentsV2(options.flags)) {
    return payload;
  }

  const content =
    typeof options.content === "string"
      ? options.content
      : null;

  const existingComponents = Array.isArray(options.components)
    ? options.components
    : [];

  const hasVisibleMessage =
    Boolean(content?.trim()) || existingComponents.length > 0;

  if (!hasVisibleMessage) {
    return payload;
  }

  const container = content
    ? buildContainer(content)
    : new ContainerBuilder().setAccentColor(colors.primary);

  for (const component of existingComponents) {
    if (!component) {
      continue;
    }

    const type =
      typeof component.toJSON === "function"
        ? component.toJSON().type
        : component.type;

    if (type === 1) {
      container.addActionRowComponents(component);
      continue;
    }

    if (type === 14) {
      container.addSeparatorComponents(component);
      continue;
    }

    if (type === 10) {
      container.addTextDisplayComponents(component);
      continue;
    }

    if (type === 17) {
      // A container is already a complete V2 layout. Preserve it as-is
      // rather than nesting a container inside another container.
      return {
        ...options,
        content: null,
        flags:
          (typeof options.flags === "number" ? options.flags : 0) |
          MessageFlags.IsComponentsV2,
      };
    }
  }

  const {
    content: _content,
    embeds: _embeds,
    stickers: _stickers,
    poll: _poll,
    components: _components,
    ...rest
  } = options;

  return {
    ...rest,
    content: undefined,
    components: [container],
    flags:
      (typeof options.flags === "number" ? options.flags : 0) |
      MessageFlags.IsComponentsV2,
  };
}

export function installInteractionMessageStyle(
  interaction: Interaction
): void {
  const target = interaction as any;

  if (target[STYLE_WRAPPED]) {
    return;
  }

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
  ];

  for (const method of methods) {
    if (typeof target[method] !== "function") {
      continue;
    }

    const original = target[method].bind(target);

    target[method] = (
      payload: unknown,
      ...rest: unknown[]
    ) =>
      original(
        normalizeMessagePayload(payload),
        ...rest
      );
  }
}
