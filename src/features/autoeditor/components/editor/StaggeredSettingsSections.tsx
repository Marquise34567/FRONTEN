import { AnimatePresence, motion } from "framer-motion";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUDIO_OPTIONS,
  CAPTION_EFFECT_OPTIONS,
  CAPTION_FONT_OPTIONS,
  CAPTION_STYLE_OPTIONS,
  PLATFORM_OPTIONS,
  STYLE_PRESETS,
  VIBE_CHIPS,
} from "@/features/autoeditor/data/options";
import CleanCard from "@/features/autoeditor/components/primitives/CleanCard";
import MinimalSlider from "@/features/autoeditor/components/primitives/MinimalSlider";
import SubtleToggle from "@/features/autoeditor/components/primitives/SubtleToggle";
import { cn } from "@/lib/utils";
import type {
  AudioOption,
  CaptionEffect,
  CaptionMode,
  CaptionStylePreset,
  FormatPreset,
  StylePreset,
  VibeChip,
} from "@/features/autoeditor/types";

const sectionMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: "easeOut" },
};

type StaggeredSettingsSectionsProps = {
  revealedSectionCount: number;
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

export default function StaggeredSettingsSections({
  revealedSectionCount,
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
}: StaggeredSettingsSectionsProps) {
  return (
    <AnimatePresence mode="popLayout">
      <div className="space-y-4">
        {revealedSectionCount >= 1 ? (
          <motion.section key="section-format" {...sectionMotion}>
            <CleanCard>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">A. Format & Platform</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map((platform) => {
                  const active = formatPreset === platform.value;
                  return (
                    <button
                      key={platform.value}
                      type="button"
                      onClick={() => onFormatPresetChange(platform.value)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                        active
                          ? "border-blue-300/40 bg-blue-500/15 text-blue-100"
                          : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20",
                      )}
                    >
                      <platform.icon className="h-3.5 w-3.5" />
                      {platform.label}
                    </button>
                  );
                })}
              </div>
            </CleanCard>
          </motion.section>
        ) : null}

        {revealedSectionCount >= 2 ? (
          <motion.section key="section-vibe" {...sectionMotion}>
            <CleanCard>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">B. Vibe & Style</p>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {VIBE_CHIPS.map((chip) => {
                  const active = vibeChip === chip.value;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => onVibeChipChange(chip.value)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1.5 text-sm transition",
                        active
                          ? "border-blue-300/40 bg-blue-500/15 text-blue-100"
                          : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20",
                      )}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {STYLE_PRESETS.map((preset) => {
                  const active = stylePreset === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => onStylePresetChange(preset.value)}
                      className={cn(
                        "rounded-xl border p-2 text-left transition-all",
                        active
                          ? "border-blue-300/35 bg-blue-500/12"
                          : "border-white/10 bg-black/20 hover:border-white/20",
                      )}
                    >
                      <div className={`h-14 rounded-lg bg-gradient-to-br ${preset.preview}`} />
                      <p className="mt-2 text-sm font-medium text-slate-100">{preset.label}</p>
                    </button>
                  );
                })}
              </div>
            </CleanCard>
          </motion.section>
        ) : null}

        {revealedSectionCount >= 3 ? (
          <motion.section key="section-cuts" {...sectionMotion}>
            <CleanCard>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">C. Cuts & Pacing</p>
              <MinimalSlider
                className="mt-3"
                value={pacingValue}
                onValueChange={onPacingValueChange}
                leftLabel="Narrative"
                rightLabel={`Intensity ${pacingValue}`}
              />
              <SubtleToggle
                className="mt-3"
                checked={autoDetectBestMoments}
                onCheckedChange={onAutoDetectBestMomentsChange}
                label="Auto-detect best moments"
                description="Uses retention and motion to prioritize high-value cuts."
              />
            </CleanCard>
          </motion.section>
        ) : null}

        {revealedSectionCount >= 4 ? (
          <motion.section key="section-captions" {...sectionMotion}>
            <CleanCard>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">D. Captions</p>

              <SubtleToggle
                className="mt-3"
                checked={captionsEnabled}
                onCheckedChange={onCaptionsEnabledChange}
                label="Enable captions"
                description="AI captions with configurable fonts, styling, and motion."
              />

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-slate-400">Mode</p>
                  <div className="flex gap-2">
                    {([
                      { value: "ai", label: "AI" },
                      { value: "manual", label: "Manual" },
                    ] as const).map((modeOption) => {
                      const active = captionMode === modeOption.value;
                      return (
                        <button
                          key={modeOption.value}
                          type="button"
                          onClick={() => onCaptionModeChange(modeOption.value)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition",
                            active
                              ? "border-blue-300/40 bg-blue-500/15 text-blue-100"
                              : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20",
                          )}
                        >
                          {modeOption.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs text-slate-400">Caption Style</p>
                  <Select value={captionStyle} onValueChange={(value) => onCaptionStyleChange(value as CaptionStylePreset)}>
                    <SelectTrigger className="border-white/10 bg-black/35 text-slate-100">
                      <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent>
                      {CAPTION_STYLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <p className="mb-1 text-xs text-slate-400">Font</p>
                  <Select value={captionFont} onValueChange={onCaptionFontChange}>
                    <SelectTrigger className="border-white/10 bg-black/35 text-slate-100">
                      <SelectValue placeholder="Select font" />
                    </SelectTrigger>
                    <SelectContent>
                      {CAPTION_FONT_OPTIONS.map((font) => (
                        <SelectItem key={font} value={font}>
                          <span style={{ fontFamily: `'${font}', Inter, sans-serif` }}>{font}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <p className="mb-1 text-xs text-slate-400">Effect</p>
                  <Select value={captionEffect} onValueChange={(value) => onCaptionEffectChange(value as CaptionEffect)}>
                    <SelectTrigger className="border-white/10 bg-black/35 text-slate-100">
                      <SelectValue placeholder="Select effect" />
                    </SelectTrigger>
                    <SelectContent>
                      {CAPTION_EFFECT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CleanCard>
          </motion.section>
        ) : null}

        {revealedSectionCount >= 5 ? (
          <motion.section key="section-audio" {...sectionMotion}>
            <CleanCard>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">E. Audio</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {AUDIO_OPTIONS.map((option) => {
                  const active = audioOption === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onAudioOptionChange(option.value)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition",
                        active
                          ? "border-blue-300/40 bg-blue-500/15 text-blue-100"
                          : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <Accordion type="multiple" className="mt-3 space-y-2">
                <AccordionItem value="ducking" className="rounded-xl border border-white/10 bg-black/20 px-3">
                  <AccordionTrigger className="py-3 text-sm text-slate-100 hover:no-underline">Ducking & Sidechain</AccordionTrigger>
                  <AccordionContent>
                    <SubtleToggle
                      checked={audioDuckingEnabled}
                      onCheckedChange={onAudioDuckingEnabledChange}
                      label="Auto voice ducking"
                      description="Lowers bed music under speech segments."
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="cleanup" className="rounded-xl border border-white/10 bg-black/20 px-3">
                  <AccordionTrigger className="py-3 text-sm text-slate-100 hover:no-underline">Noise Cleanup</AccordionTrigger>
                  <AccordionContent>
                    <SubtleToggle
                      checked={audioCleanupEnabled}
                      onCheckedChange={onAudioCleanupEnabledChange}
                      label="Dialogue clarity"
                      description="Removes rumble and broad hiss with light denoise profile."
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="mastering" className="rounded-xl border border-white/10 bg-black/20 px-3">
                  <AccordionTrigger className="py-3 text-sm text-slate-100 hover:no-underline">Mastering</AccordionTrigger>
                  <AccordionContent>
                    <SubtleToggle
                      checked={audioMasteringEnabled}
                      onCheckedChange={onAudioMasteringEnabledChange}
                      label="Loudness normalization"
                      description="Targets platform-safe LUFS with transparent limiter headroom."
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CleanCard>
          </motion.section>
        ) : null}
      </div>
    </AnimatePresence>
  );
}
