// ==========================================================
// EMOJIS ANIMADOS DO ATLAS
// ==========================================================

export const animatedEmojis = {
  medalGranted: process.env.ATLAS_EMOJI_MEDAL_GRANTED ?? "<a:medal_granted:1541970399514992741>",
  error: process.env.ATLAS_EMOJI_ERROR ?? "<a:error:1541970321547198544>",
  success: process.env.ATLAS_EMOJI_SUCCESS ?? "<a:success:1541975920611430570>",
  warning: process.env.ATLAS_EMOJI_WARNING ?? "<a:warning:1541970493102628874>",
  loading: process.env.ATLAS_EMOJI_LOADING ?? "<a:loading:1541970363506757712>",
  analysis: process.env.ATLAS_EMOJI_ANALYSIS ?? "<a:analysis:1541970235538669678>",
  configuration: process.env.ATLAS_EMOJI_CONFIGURATION ?? "<a:configuration:1541975079141908500>",
} as const;

const replacements: Array<[string, string]> = [
  ["❌", animatedEmojis.error],
  ["⚠️", animatedEmojis.warning],
  ["✅", animatedEmojis.success],
  ["🟢", animatedEmojis.success],
  ["🔄", animatedEmojis.loading],
  ["🔍", animatedEmojis.analysis],
  ["⚙️", animatedEmojis.configuration],
  ["🛠️", animatedEmojis.configuration],
  ["🏅", animatedEmojis.medalGranted],
  ["🎖️", animatedEmojis.medalGranted],
];

// Emojis animados aparecem somente no início do conteúdo.
// Em headings como "## ❌ Erro", o emoji também é considerado início visual.
export function replaceAnimatedEmojis(content: string): string {
  let result = content;

  for (const [staticEmoji, animatedEmoji] of replacements) {
    const escaped = staticEmoji.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^(#{1,3}\\s*)?${escaped}`, "u");
    result = result.replace(regex, (match, heading = "") => `${heading}${animatedEmoji}`);
  }

  return result;
}

export function replaceAnimatedEmojisInComponents(components: unknown): unknown {
  if (!Array.isArray(components)) return components;

  return components.map((component) => {
    if (!component) return component;

    const json = typeof (component as any).toJSON === "function"
      ? (component as any).toJSON()
      : component;

    return replaceAnimatedEmojisInComponent(json);
  });
}

function replaceAnimatedEmojisInComponent(component: any): any {
  if (!component || typeof component !== "object") return component;

  const result: Record<string, any> = { ...component };

  if (typeof result.content === "string") {
    result.content = replaceAnimatedEmojis(result.content);
  }

  if (Array.isArray(result.components)) {
    result.components = result.components.map((child: unknown) =>
      replaceAnimatedEmojisInComponent(
        typeof (child as any)?.toJSON === "function" ? (child as any).toJSON() : child,
      ),
    );
  }

  return result;
}
