import { Camera, MessageSquareText, Type } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  CAPTION_EFFECT_OPTIONS,
  CAPTION_FONT_OPTIONS,
  CAPTION_STYLE_OPTIONS,
} from "@/features/autoeditor/data/options";
import type {
  CaptionEffect,
  CaptionMode,
  CaptionStylePreset,
  VerticalWebcamLayout,
} from "@/features/autoeditor/types";
import { cn } from "@/lib/utils";

const WEBCAM_LAYOUT_OPTIONS: Array<{ value: VerticalWebcamLayout; label: string; description: string }> = [
  { value: "top_banner", label: "Top Banner", description: "Classic stacked shorts layout with webcam at the top." },
  { value: "top_right_pip", label: "Top Right PIP", description: "Picture-in-picture bubble in the top right." },
  { value: "bottom_right_pip", label: "Bottom Right PIP", description: "Picture-in-picture bubble in the lower right." },
];

type VerticalModeToolkitProps = {
  captionsEnabled: boolean;
  onCaptionsEnabledChange: (value: boolean) => void;
  captionMode: CaptionMode;
  onCaptionModeChange: (value: CaptionMode) => void;
  captionStyle: CaptionStylePreset;
  onCaptionStyleChange: (value: CaptionStylePreset) => void;
  captionFont: string;
  onCaptionFontChange: (value: string) => void;
  captionEffect: CaptionEffect;
  onCaptionEffectChange: (value: CaptionEffect) => void;
  webcamEnabled: boolean;
  onWebcamEnabledChange: (value: boolean) => void;
  webcamLayout: VerticalWebcamLayout;
  onWebcamLayoutChange: (value: VerticalWebcamLayout) => void;
  captionOutlineEnabled: boolean;
  onCaptionOutlineEnabledChange: (value: boolean) => void;
  captionDropShadowEnabled: boolean;
  onCaptionDropShadowEnabledChange: (value: boolean) => void;
};

export default function VerticalModeToolkit({
  captionsEnabled,
  onCaptionsEnabledChange,
  captionMode,
  onCaptionModeChange,
  captionStyle,
  onCaptionStyleChange,
  captionFont,
  onCaptionFontChange,
  captionEffect,
  onCaptionEffectChange,
  webcamEnabled,
  onWebcamEnabledChange,
  webcamLayout,
  onWebcamLayoutChange,
  captionOutlineEnabled,
  onCaptionOutlineEnabledChange,
  captionDropShadowEnabled,
  onCaptionDropShadowEnabledChange,
}: VerticalModeToolkitProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-[var(--gold-accent)]">
          <Camera className="h-3.5 w-3.5" />
          Webcam Stack
        </p>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
          <div>
            <p className="text-sm text-slate-100">Enable Webcam Layer</p>
            <p className="text-xs text-slate-400">
              Turn this off to render pure 9:16 video with no top webcam panel.
            </p>
          </div>
          <Switch checked={webcamEnabled} onCheckedChange={onWebcamEnabledChange} />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {WEBCAM_LAYOUT_OPTIONS.map((option) => {
            const active = webcamLayout === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onWebcamLayoutChange(option.value)}
                disabled={!webcamEnabled}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left transition",
                  active
                    ? "border-[rgba(52,240,208,0.42)] bg-[rgba(52,240,208,0.12)] text-[#95fff2]"
                    : "border-white/10 bg-black/35 text-slate-300 hover:border-[rgba(52,240,208,0.3)]",
                  !webcamEnabled && "cursor-not-allowed opacity-55",
                )}
              >
                <p className="text-sm font-medium">{option.label}</p>
                <p className="mt-1 text-xs text-slate-400">{option.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-[var(--gold-accent)]">
          <MessageSquareText className="h-3.5 w-3.5" />
          Captions + Subtitles
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {CAPTION_STYLE_OPTIONS.length} style presets, {CAPTION_FONT_OPTIONS.length} font choices, and outline/shadow controls.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
            <p className="text-sm text-slate-100">Enable Captions</p>
            <p className="text-xs text-slate-400">Use AI-generated subtitles or keep manual-only mode.</p>
            <div className="mt-2 flex items-center justify-end">
              <Switch checked={captionsEnabled} onCheckedChange={onCaptionsEnabledChange} />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
            <p className="text-sm text-slate-100">Caption Workflow</p>
            <div className="mt-2 flex gap-2">
              {([
                { value: "ai", label: "AI Generated" },
                { value: "manual", label: "Manual Only" },
              ] as const).map((option) => {
                const active = captionMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onCaptionModeChange(option.value)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition",
                      active
                        ? "border-[rgba(52,240,208,0.45)] bg-[rgba(52,240,208,0.14)] text-slate-100"
                        : "border-white/10 bg-black/35 text-slate-300 hover:border-[rgba(52,240,208,0.32)]",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <p className="mb-1 text-xs text-slate-400">Caption Style</p>
            <Select value={captionStyle} onValueChange={(value) => onCaptionStyleChange(value as CaptionStylePreset)}>
              <SelectTrigger className="border-white/15 bg-black/40 text-slate-100 hover:border-[rgba(52,240,208,0.45)]">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent className="border-white/20 bg-[#14161d] text-[#f6eee2]">
                {CAPTION_STYLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-400">Caption Font</p>
            <Select value={captionFont} onValueChange={onCaptionFontChange}>
              <SelectTrigger className="border-white/15 bg-black/40 text-slate-100 hover:border-[rgba(52,240,208,0.45)]">
                <SelectValue placeholder="Select font" />
              </SelectTrigger>
              <SelectContent className="border-white/20 bg-[#14161d] text-[#f6eee2]">
                {CAPTION_FONT_OPTIONS.map((font) => (
                  <SelectItem key={font} value={font}>
                    <span style={{ fontFamily: `'${font}', Inter, sans-serif` }}>{font}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-400">Motion / Effect</p>
            <Select value={captionEffect} onValueChange={(value) => onCaptionEffectChange(value as CaptionEffect)}>
              <SelectTrigger className="border-white/15 bg-black/40 text-slate-100 hover:border-[rgba(52,240,208,0.45)]">
                <SelectValue placeholder="Select effect" />
              </SelectTrigger>
              <SelectContent className="border-white/20 bg-[#14161d] text-[#f6eee2]">
                {CAPTION_EFFECT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
            <div>
              <p className="text-sm text-slate-100">Outline</p>
              <p className="text-xs text-slate-400">Improves readability on busy footage.</p>
            </div>
            <Switch checked={captionOutlineEnabled} onCheckedChange={onCaptionOutlineEnabledChange} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
            <div>
              <p className="text-sm text-slate-100">Drop Shadow</p>
              <p className="text-xs text-slate-400">Adds depth for short-form caption impact.</p>
            </div>
            <Switch checked={captionDropShadowEnabled} onCheckedChange={onCaptionDropShadowEnabledChange} />
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-[rgba(52,240,208,0.32)] bg-[rgba(52,240,208,0.12)] px-3 py-2 text-xs text-[#95fff2]">
          <span className="font-medium">Tip:</span> Use <span className="font-medium">Impact Clean (No Lightning)</span> +
          outline + soft shadow for high-contrast TikTok subtitles without flashy strike effects.
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-emerald-200">
          <Type className="h-3.5 w-3.5" />
          Popular Presets
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["impact_clean", "tiktok_bold", "shorts_highlight", "punch_outline", "soft_shadow", "high_contrast"].map(
            (value) => {
              const option = CAPTION_STYLE_OPTIONS.find((entry) => entry.value === value);
              if (!option) return null;
              const active = captionStyle === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onCaptionStyleChange(option.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    active
                      ? "border-emerald-300/40 bg-emerald-500/12 text-emerald-100"
                      : "border-white/10 bg-black/35 text-slate-300 hover:border-white/20",
                  )}
                >
                  {option.label}
                </button>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}

