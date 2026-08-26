// ==========================================================
// EMOJIS ANIMADOS DO ATLAS
// ==========================================================
//
// Os valores abaixo devem ser preenchidos com a sintaxe do
// emoji personalizado do Discord, por exemplo:
//
// <a:success:123456789012345678>
//
// Mantemos um fallback estático para que o Atlas continue
// funcionando normalmente antes dos emojis serem configurados.
// ==========================================================

export const animatedEmojis = {
  medalGranted:
    process.env.ATLAS_EMOJI_MEDAL_GRANTED ?? "🏅",

  error:
    process.env.ATLAS_EMOJI_ERROR ?? "❌",

  success:
    process.env.ATLAS_EMOJI_SUCCESS ?? "✅",

  warning:
    process.env.ATLAS_EMOJI_WARNING ?? "⚠️",

  loading:
    process.env.ATLAS_EMOJI_LOADING ?? "🔄",

  analysis:
    process.env.ATLAS_EMOJI_ANALYSIS ?? "🔍",

  configuration:
    process.env.ATLAS_EMOJI_CONFIGURATION ?? "🛠️",
} as const;

// ==========================================================
// SUBSTITUI EMOJIS ESTÁTICOS PELOS ANIMADOS
// ==========================================================

export function replaceAnimatedEmojis(
  content: string
): string {
  return content
    .replaceAll("❌", animatedEmojis.error)
    .replaceAll("⚠️", animatedEmojis.warning)
    .replaceAll("✅", animatedEmojis.success)
    .replaceAll("🟢", animatedEmojis.success)
    .replaceAll("🔄", animatedEmojis.loading)
    .replaceAll("🔍", animatedEmojis.analysis)
    .replaceAll("⚙️", animatedEmojis.configuration)
    .replaceAll("🛠️", animatedEmojis.configuration)
    .replaceAll("🏅", animatedEmojis.medalGranted)
    .replaceAll("🎖️", animatedEmojis.medalGranted);
}

// ==========================================================
// CONVERSÃO SEGURA DE COMPONENTES V2
// ==========================================================

export function replaceAnimatedEmojisInComponents(
  components: unknown
): unknown {
  if (!Array.isArray(components)) {
    return components;
  }

  return components.map((component) => {
    if (!component) {
      return component;
    }

    const json =
      typeof (component as any).toJSON === "function"
        ? (component as any).toJSON()
        : component;

    return replaceAnimatedEmojisInComponent(json);
  });
}

function replaceAnimatedEmojisInComponent(
  component: any
): any {
  if (!component || typeof component !== "object") {
    return component;
  }

  const result: Record<string, any> = {
    ...component,
  };

  if (typeof result.content === "string") {
    result.content = replaceAnimatedEmojis(
      result.content
    );
  }

  if (Array.isArray(result.components)) {
    result.components = result.components.map(
      (child: unknown) =>
        replaceAnimatedEmojisInComponent(
          typeof (child as any)?.toJSON === "function"
            ? (child as any).toJSON()
            : child
        )
    );
  }

  if (result.emoji?.name) {
    result.emoji = {
      ...result.emoji,
    };
  }

  return result;
}
