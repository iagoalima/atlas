// ==========================================================
// EMOJIS ANIMADOS DO ATLAS
// ==========================================================
//
// IDs dos emojis personalizados cadastrados no servidor Atlas.
// Variáveis de ambiente podem sobrescrever os valores.
// ==========================================================

export const animatedEmojis = {
  medalGranted:
    process.env.ATLAS_EMOJI_MEDAL_GRANTED ??
    "<a:medal_granted:1541970399514992741>",
  error:
    process.env.ATLAS_EMOJI_ERROR ??
    "<a:error:1541970321547198544>",
  success:
    process.env.ATLAS_EMOJI_SUCCESS ??
    "<a:success:1541975920611430570>",
  warning:
    process.env.ATLAS_EMOJI_WARNING ??
    "<a:warning:1541970493102628874>",
  loading:
    process.env.ATLAS_EMOJI_LOADING ??
    "<a:loading:1541970363506757712>",
  analysis:
    process.env.ATLAS_EMOJI_ANALYSIS ??
    "<a:analysis:1541970235538669678>",
  configuration:
    process.env.ATLAS_EMOJI_CONFIGURATION ??
    "<a:configuration:1541975079141908500>",
} as const;

// ==========================================================
// SUBSTITUI EMOJIS ESTÁTICOS PELOS ANIMADOS
// ==========================================================
//
// Regra visual do Atlas:
// - Somente o primeiro emoji do conteúdo pode ser animado.
// - Emojis no meio ou no final permanecem estáticos.
// - 🟢 permanece sempre estático.
// ==========================================================

function getAnimatedEmoji(emoji: string): string {
  switch (emoji) {
    case "❌":
      return animatedEmojis.error;
    case "⚠️":
      return animatedEmojis.warning;
    case "✅":
      return animatedEmojis.success;
    case "🔄":
      return animatedEmojis.loading;
    case "🔍":
      return animatedEmojis.analysis;
    case "⚙️":
    case "🛠️":
      return animatedEmojis.configuration;
    case "🏅":
    case "🎖️":
      return animatedEmojis.medalGranted;
    default:
      return emoji;
  }
}

export function replaceAnimatedEmojis(content: string): string {
  const match = content.match(
    /^(\s*)(❌|⚠️|✅|🔄|🔍|⚙️|🛠️|🏅|🎖️)(?=\s|$)/
  );

  if (!match) {
    return content;
  }

  return `${match[1]}${getAnimatedEmoji(match[2])}${content.slice(match[0].length)}`;
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

  return result;
}
