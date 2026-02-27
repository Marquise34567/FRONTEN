import { useMemo } from "react";
import { motion } from "framer-motion";
import { LayoutPanelTop, SlidersHorizontal, Sparkles } from "lucide-react";

import {
  AUDIO_OPTIONS,
  CAPTION_EFFECT_OPTIONS,
  CAPTION_FONT_OPTIONS,
  CAPTION_STYLE_OPTIONS,
  PLATFORM_OPTIONS,
  QUICK_CONTROL_CONFIG,
  STYLE_PRESETS,
  VIBE_CHIPS,
} from "@/features/autoeditor/data/options";
import CleanCard from "@/features/autoeditor/components/primitives/CleanCard";
import MinimalSlider from "@/features/autoeditor/components/primitives/MinimalSlider";
import SubtleToggle from "@/features/autoeditor/components/primitives/SubtleToggle";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  AudioOption,
  CaptionEffect,
  CaptionMode,
  CaptionStylePreset,
  FormatPreset,
  QuickControlKey,
  RenderMode,
  StylePreset,
  VibeChip,
} from "@/features/autoeditor/types";

type ModernizedOriginalEditorProps = {
  mode: RenderMode | null;
  quickControls: Record<QuickControlKey, boolean>;
  onToggleQuickControl: (key: QuickControlKey) => void;

  formatPreset: FormatPreset;
  onFormatPresetChange: (value: FormatPreset) => void;

  vibeChip: VibeChip;
  onVibeChipChange: (value: VibeChip) => void;
  stylePreset: StylePreset;
  onStylePresetChange: (value: StylePreset) => void;

  pacingValue: number;
  onPacingValueChange: (value: number) => void;
  autoDetectBestMoments: boolean;
  onAutoDetectBestMomentsChange: (value: boolean) => void;

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

  audioOption: AudioOption;
  onAudioOptionChange: (value: AudioOption) => void;
  audioDuckingEnabled: boolean;
  onAudioDuckingEnabledChange: (value: boolean) => void;
  audioCleanupEnabled: boolean;
  onAudioCleanupEnabledChange: (value: boolean) => void;
  audioMasteringEnabled: boolean;
  onAudioMasteringEnabledChange: (value: boolean) => void;
};

const sectionButtonClass = (active: boolean) =>
  cn(
    "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all",
    active
      ? "border-[#e6cfa9]/45 bg-[#d4b483]/16 text-[#fff2de] shadow-[0_14px_30px_-24px_rgba(212,180,131,0.62)]"
      : "border-white/15 bg-black/22 text-[#d4c9cd] hover:border-white/25 hover:bg-black/35",
  );

const controlChipClass = (active: boolean) =>
  cn(
    "rounded-full border px-3 py-1.5 text-sm transition",
    active
      ? "border-[#e6cfa9]/45 bg-[#d4b483]/16 text-[#fff2de]"
      : "border-white/15 bg-white/5 text-[#d4c9cd] hover:border-white/25 hover:bg-white/[0.09]",
  );

export default function ModernizedOriginalEditor({
  mode,
  quickControls,
  onToggleQuickControl,
  formatPreset,
  onFormatPresetChange,
  vibeChip,
  onVibeChipChange,
  stylePreset,
  onStylePresetChange,
  pacingValue,
  onPacingValueChange,
  autoDetectBestMoments,
  onAutoDetectBestMomentsChange,
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
  audioOption,
  onAudioOptionChange,
  audioDuckingEnabled,
  onAudioDuckingEnabledChange,
  audioCleanupEnabled,
  onAudioCleanupEnabledChange,
  audioMasteringEnabled,
  onAudioMasteringEnabledChange,
}: ModernizedOriginalEditorProps) {
  const enabledControlCount = useMemo(
    () => Object.values(quickControls).filter(Boolean).length,
    [quickControls],
  );
  const modeLabel = mode === "vertical" ? "Vertical 9:16" : "Horizontal 16:9";

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeInOut" }}
    >
      <CleanCard>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="ae-kicker">Original Editor, Modernized</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-[#f8efe3]">Classic Control Deck</h3>
            <p className="mt-1 text-sm text-[#baafb1]">
              A rebuilt version of the original editor control layout inside the new UI system.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs text-[#d6cbce]">
              <LayoutPanelTop className="h-3.5 w-3.5" />
              {modeLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#e6cfa9]/35 bg-[#d4b483]/14 px-3 py-1 text-xs text-[#f8ecd8]">
              <Sparkles className="h-3.5 w-3.5" />
              {enabledControlCount}/4 quick controls
            </span>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-white/15 bg-black/25 p-3">
              <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#b7aeb0]">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Precision Quick Controls
              </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {QUICK_CONTROL_CONFIG.map((control) => {
              const active = quickControls[control.key];
              return (
                <button
                  key={control.key}
                  type="button"
                  onClick={() => onToggleQuickControl(control.key)}
                  className={sectionButtonClass(active)}
                >
                  <control.icon className="h-4 w-4" />
                  <span>{control.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Tabs defaultValue="format" className="space-y-3">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-1.5 md:grid-cols-4">
            <TabsTrigger
              value="format"
              className="min-h-11 rounded-lg border border-transparent text-xs text-slate-300 data-[state=active]:border-[#e6cfa9]/55 data-[state=active]:bg-[#d4b483]/18 data-[state=active]:text-[#fff2de]"
            >
              Format
            </TabsTrigger>
            <TabsTrigger
              value="vibe"
              className="min-h-11 rounded-lg border border-transparent text-xs text-slate-300 data-[state=active]:border-[#e6cfa9]/55 data-[state=active]:bg-[#d4b483]/18 data-[state=active]:text-[#fff2de]"
            >
              Vibe
            </TabsTrigger>
            <TabsTrigger
              value="cuts"
              className="min-h-11 rounded-lg border border-transparent text-xs text-slate-300 data-[state=active]:border-[#e6cfa9]/55 data-[state=active]:bg-[#d4b483]/18 data-[state=active]:text-[#fff2de]"
            >
              Cuts
            </TabsTrigger>
            <TabsTrigger
              value="captions-audio"
              className="min-h-11 rounded-lg border border-transparent text-xs text-slate-300 data-[state=active]:border-[#e6cfa9]/55 data-[state=active]:bg-[#d4b483]/18 data-[state=active]:text-[#fff2de]"
            >
              Captions & Audio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="format" className="mt-0 space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#b7aeb0]">Output Platform</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PLATFORM_OPTIONS.map((platform) => (
                  <button
                    key={platform.value}
                    type="button"
                    onClick={() => onFormatPresetChange(platform.value)}
                    className={sectionButtonClass(formatPreset === platform.value)}
                  >
                    <platform.icon className="h-4 w-4" />
                    <span>{platform.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="vibe" className="mt-0 space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#b7aeb0]">Vibe Chip</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {VIBE_CHIPS.map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => onVibeChipChange(chip.value)}
                    className={cn(controlChipClass(vibeChip === chip.value), "inline-flex items-center gap-1.5")}
                  >
                    <chip.icon className="h-3.5 w-3.5" />
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#b7aeb0]">Style Preset</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => onStylePresetChange(preset.value)}
                    className={cn(
                      "rounded-xl border p-2 text-left transition-all",
                      stylePreset === preset.value
                        ? "border-[#e6cfa9]/45 bg-[#d4b483]/14 shadow-[0_14px_30px_-24px_rgba(212,180,131,0.62)]"
                        : "border-white/15 bg-black/22 hover:border-white/25 hover:bg-black/35",
                    )}
                  >
                    <div className={`h-14 rounded-lg bg-gradient-to-br ${preset.preview}`} />
                    <p className="mt-2 text-sm font-medium text-[#f7efe2]">{preset.label}</p>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cuts" className="mt-0 space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#b7aeb0]">Cut Intensity</p>
              <MinimalSlider
                className="mt-3"
                value={pacingValue}
                onValueChange={onPacingValueChange}
                leftLabel="Narrative Flow"
                rightLabel="Cut Intensity"
              />
              <SubtleToggle
                className="mt-3"
                checked={autoDetectBestMoments}
                onCheckedChange={onAutoDetectBestMomentsChange}
                label="Auto Hook + Best-Moment Detection"
                description="Keeps high-retention sections, prepends a 5-8s hook, and normalizes auto cuts to 5s."
              />
            </div>
          </TabsContent>

          <TabsContent value="captions-audio" className="mt-0 space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <SubtleToggle
                checked={captionsEnabled}
                onCheckedChange={onCaptionsEnabledChange}
                label="Captions"
                description="AI and manual modes with style presets inspired by the original editor."
              />

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-[#b7aeb0]">Mode</p>
                  <div className="flex gap-2">
                    {([
                      { value: "ai", label: "AI" },
                      { value: "manual", label: "Manual" },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={controlChipClass(captionMode === option.value)}
                        onClick={() => onCaptionModeChange(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs text-[#b7aeb0]">Caption Style</p>
                  <Select value={captionStyle} onValueChange={(value) => onCaptionStyleChange(value as CaptionStylePreset)}>
                    <SelectTrigger className="border-white/15 bg-black/35 text-[#f8efe3] hover:border-[#e6cfa9]/45">
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
                  <p className="mb-1 text-xs text-[#b7aeb0]">Font</p>
                  <Select value={captionFont} onValueChange={onCaptionFontChange}>
                    <SelectTrigger className="border-white/15 bg-black/35 text-[#f8efe3] hover:border-[#e6cfa9]/45">
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
                  <p className="mb-1 text-xs text-[#b7aeb0]">Effect</p>
                  <Select value={captionEffect} onValueChange={(value) => onCaptionEffectChange(value as CaptionEffect)}>
                    <SelectTrigger className="border-white/15 bg-black/35 text-[#f8efe3] hover:border-[#e6cfa9]/45">
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
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.14em] text-[#b7aeb0]">Audio Profile</p>
              <div className="flex flex-wrap gap-2">
                {AUDIO_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onAudioOptionChange(option.value)}
                    className={cn(controlChipClass(audioOption === option.value), "inline-flex items-center gap-1.5")}
                  >
                    <option.icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                <SubtleToggle
                  checked={audioDuckingEnabled}
                  onCheckedChange={onAudioDuckingEnabledChange}
                  label="Auto ducking"
                  description="Lowers bed music under speech."
                />
                <SubtleToggle
                  checked={audioCleanupEnabled}
                  onCheckedChange={onAudioCleanupEnabledChange}
                  label="Noise cleanup"
                  description="Reduces hiss and low-frequency rumble."
                />
                <SubtleToggle
                  checked={audioMasteringEnabled}
                  onCheckedChange={onAudioMasteringEnabledChange}
                  label="Mastering"
                  description="Normalizes loudness for platform-safe output."
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CleanCard>
    </motion.section>
  );
}
