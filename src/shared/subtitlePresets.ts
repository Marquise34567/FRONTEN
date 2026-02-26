export type SubtitlePresetId =
  | "basic_clean"
  | "bold_pop"
  | "outline_heavy"
  | "caption_box"
  | "karaoke_highlight"
  | "mrbeast_animated"
  | "neon_glow";

export type SubtitleFontId = "impact" | "sans_bold" | "condensed" | "serif_bold";
export type SubtitleAnimationId = "pop" | "none";

export type SubtitleStyleConfig = {
  preset: SubtitlePresetId;
  fontId: SubtitleFontId;
  fontSize: number;
  textColor: string;
  accentColor: string;
  outlineColor: string;
  outlineWidth: number;
  animation: SubtitleAnimationId;
};

export const MRBEAST_FONT_OPTIONS: Array<{ id: SubtitleFontId; label: string }> = [
  { id: "impact", label: "Impact" },
  { id: "sans_bold", label: "Sans Bold" },
  { id: "condensed", label: "Condensed" },
  { id: "serif_bold", label: "Serif Bold" },
];

export const MRBEAST_ANIMATION_OPTIONS: Array<{ id: SubtitleAnimationId; label: string }> = [
  { id: "pop", label: "Pop In" },
  { id: "none", label: "Static" },
];

const STYLE_CONFIG_DELIMITER = "::";
const DEFAULT_STYLE: Omit<SubtitleStyleConfig, "preset"> = {
  fontId: "impact",
  fontSize: 58,
  textColor: "FFFFFF",
  accentColor: "00E5FF",
  outlineColor: "111111",
  outlineWidth: 6,
  animation: "pop",
};

const normalizeHex = (value?: string | null) => {
  if (!value) return null;
  const compact = String(value).trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(compact)) return null;
  return compact.toUpperCase();
};

const normalizePreset = (value?: string | null): SubtitlePresetId => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "basic_clean") return "basic_clean";
  if (raw === "bold_pop") return "bold_pop";
  if (raw === "outline_heavy") return "outline_heavy";
  if (raw === "caption_box") return "caption_box";
  if (raw === "karaoke_highlight") return "karaoke_highlight";
  if (raw === "mrbeast_animated") return "mrbeast_animated";
  if (raw === "neon_glow") return "neon_glow";
  if (raw === "mrbeast" || raw === "mr beast" || raw === "mrbeaststyle") return "mrbeast_animated";
  return "basic_clean";
};

const normalizeFont = (value?: string | null): SubtitleFontId => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "impact") return "impact";
  if (raw === "sans_bold") return "sans_bold";
  if (raw === "condensed") return "condensed";
  if (raw === "serif_bold") return "serif_bold";
  return DEFAULT_STYLE.fontId;
};

const normalizeAnimation = (value?: string | null): SubtitleAnimationId => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "none") return "none";
  return "pop";
};

const normalizeOutlineWidth = (value?: number | string | null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_STYLE.outlineWidth;
  return Math.max(1, Math.min(24, Math.round(parsed)));
};

const normalizeFontSize = (value?: number | string | null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_STYLE.fontSize;
  return Math.max(32, Math.min(220, Math.round(parsed)));
};

const parsePairs = (raw: string) => {
  const out: Record<string, string> = {};
  const pairs = raw.split(/[;,&]/).map((pair) => pair.trim()).filter(Boolean);
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.split("=");
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.trim().toLowerCase();
    const value = rest.join("=").trim();
    if (!key || !value) continue;
    out[key] = value;
  }
  return out;
};

export const parseSubtitleStyleConfig = (value?: string | null): SubtitleStyleConfig => {
  const raw = String(value || "").trim();
  const splitIndex = raw.indexOf(STYLE_CONFIG_DELIMITER);
  const presetToken = splitIndex === -1 ? raw : raw.slice(0, splitIndex);
  const preset = normalizePreset(presetToken);
  const defaults: SubtitleStyleConfig = {
    preset,
    ...DEFAULT_STYLE,
  };
  if (splitIndex === -1) return defaults;
  const payload = parsePairs(raw.slice(splitIndex + STYLE_CONFIG_DELIMITER.length));
  return {
    ...defaults,
    fontId: normalizeFont(payload.font ?? payload.fontid),
    fontSize: normalizeFontSize(payload.fontsize ?? payload.size),
    textColor: normalizeHex(payload.text ?? payload.textcolor) ?? defaults.textColor,
    accentColor: normalizeHex(payload.accent ?? payload.accentcolor) ?? defaults.accentColor,
    outlineColor: normalizeHex(payload.outline ?? payload.outlinecolor) ?? defaults.outlineColor,
    outlineWidth: normalizeOutlineWidth(payload.outlinewidth ?? payload.border),
    animation: normalizeAnimation(payload.animation),
  };
};

export const serializeSubtitleStyleConfig = (config: SubtitleStyleConfig) => {
  const preset = normalizePreset(config.preset);
  const supportsExtendedConfig = preset === "mrbeast_animated" || preset === "neon_glow";
  if (!supportsExtendedConfig) return preset;
  const normalized = parseSubtitleStyleConfig(
    `${preset}${STYLE_CONFIG_DELIMITER}` +
      `font=${config.fontId};` +
      `fontSize=${config.fontSize};` +
      `text=${config.textColor};` +
      `accent=${config.accentColor};` +
      `outline=${config.outlineColor};` +
      `outlineWidth=${config.outlineWidth};` +
      `animation=${config.animation}`,
  );
  return (
    `${preset}${STYLE_CONFIG_DELIMITER}` +
    `font=${normalized.fontId};` +
    `fontSize=${normalized.fontSize};` +
    `text=${normalized.textColor};` +
    `accent=${normalized.accentColor};` +
    `outline=${normalized.outlineColor};` +
    `outlineWidth=${normalized.outlineWidth};` +
    `animation=${normalized.animation}`
  );
};
