// ==========================================================
// EMOJIS ANIMADOS DO ATLAS
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

export function replaceAnimatedEmojis(content: string): string {
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

function serializeComponent(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const toJSON = Reflect.get(value, "toJSON");
  return typeof toJSON === "function" ? toJSON.call(value) : value;
}

function replaceAnimatedEmojisInComponent(component: unknown): unknown {
  if (!component || typeof component !== "object" || Array.isArray(component)) {
    return component;
  }

  const result: Record<string, unknown> = {
    ...(component as Record<string, unknown>),
  };

  if (typeof result.content === "string") {
    result.content = replaceAnimatedEmojis(result.content);
  }

  if (Array.isArray(result.components)) {
    result.components = result.components.map((child: unknown) =>
      replaceAnimatedEmojisInComponent(serializeComponent(child)),
    );
  }

  return result;
}

export function replaceAnimatedEmojisInComponents(components: unknown): unknown {
  if (!Array.isArray(components)) return components;

  return components.map((component: unknown) =>
    replaceAnimatedEmojisInComponent(serializeComponent(component)),
  );
}
