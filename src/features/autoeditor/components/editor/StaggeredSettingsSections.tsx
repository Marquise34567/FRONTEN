import { AnimatePresence, motion } from "framer-motion";
import { Clapperboard, MessageSquareText, Scissors, Volume2, Wand2 } from "lucide-react";

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
  transition: { duration: 0.24, ease: "easeInOut" },
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
              <p className="ae-kicker inline-flex items-center gap-1.5">
                <Clapperboard className="h-3.5 w-3.5" />
                A. Format & Platform Target
              </p>
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
                          ? "border-[#e6cfa9]/45 bg-[#d4b483]/16 text-[#fff2de] shadow-[0_12px_26px_-20px_rgba(212,180,131,0.72)]"
                          : "border-white/15 bg-white/5 text-[#d4c9cd] hover:border-white/25 hover:bg-white/[0.09]",
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
              <p className="ae-kicker inline-flex items-center gap-1.5">
                <Wand2 className="h-3.5 w-3.5" />
                B. Creative Direction & Style
              </p>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {VIBE_CHIPS.map((chip) => {
                  const active = vibeChip === chip.value;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => onVibeChipChange(chip.value)}
                      className={cn(
                        "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition",
                        active
                          ? "border-[#e6cfa9]/45 bg-[#d4b483]/16 text-[#fff2de]"
                          : "border-white/15 bg-white/5 text-[#d4c9cd] hover:border-white/25 hover:bg-white/[0.09]",
                      )}
                    >
                      <chip.icon className="h-3.5 w-3.5" />
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
                          ? "border-[#e6cfa9]/45 bg-[#d4b483]/14 shadow-[0_14px_30px_-24px_rgba(212,180,131,0.62)]"
                          : "border-white/15 bg-black/22 hover:border-white/25 hover:bg-black/35",
                      )}
                    >
                      <div className={`h-14 rounded-lg bg-gradient-to-br ${preset.preview}`} />
                      <p className="mt-2 text-sm font-medium text-[#f7efe2]">{preset.label}</p>
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
              <p className="ae-kicker inline-flex items-center gap-1.5">
                <Scissors className="h-3.5 w-3.5" />
                C. Hooking, Cuts & Pacing
              </p>
              <MinimalSlider
                className="mt-3"
                value={pacingValue}
                onValueChange={onPacingValueChange}
                leftLabel="Narrative Flow"
                rightLabel={`Cut Intensity ${pacingValue}`}
              />
              <SubtleToggle
                className="mt-3"
                checked={autoDetectBestMoments}
                onCheckedChange={onAutoDetectBestMomentsChange}
                label="Auto Hook + Best-Moment Detection"
                description="Uses frame + retention scoring, then auto mode keeps cuts at 5s and the opener at 5-8s."
              />
            </CleanCard>
          </motion.section>
        ) : null}

        {revealedSectionCount >= 4 ? (
          <motion.section key="section-captions" {...sectionMotion}>
            <CleanCard>
              <p className="ae-kicker inline-flex items-center gap-1.5">
                <MessageSquareText className="h-3.5 w-3.5" />
                D. Caption Intelligence
              </p>

              <SubtleToggle
                className="mt-3"
                checked={captionsEnabled}
                onCheckedChange={onCaptionsEnabledChange}
                label="Enable AI Captions"
                description="Retention-focused captions with configurable typography, styling, and animation."
              />

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-[#b7aeb0]">Caption Workflow</p>
                  <div className="flex gap-2">
                    {([
                      { value: "ai", label: "AI Generated" },
                      { value: "manual", label: "Manual Only" },
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
                              ? "border-[#e6cfa9]/45 bg-[#d4b483]/16 text-[#fff2de]"
                              : "border-white/15 bg-white/5 text-[#d4c9cd] hover:border-white/25 hover:bg-white/[0.09]",
                          )}
                        >
                          {modeOption.label}
                        </button>
                      );
                    })}
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
                  <p className="mb-1 text-xs text-[#b7aeb0]">Caption Font Family</p>
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
                  <p className="mb-1 text-xs text-[#b7aeb0]">Motion Effect</p>
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
            </CleanCard>
          </motion.section>
        ) : null}

        {revealedSectionCount >= 5 ? (
          <motion.section key="section-audio" {...sectionMotion}>
            <CleanCard>
              <p className="ae-kicker inline-flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5" />
                E. Audio Mix & Delivery
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {AUDIO_OPTIONS.map((option) => {
                  const active = audioOption === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onAudioOptionChange(option.value)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition",
                        active
                          ? "border-[#e6cfa9]/45 bg-[#d4b483]/16 text-[#fff2de]"
                          : "border-white/15 bg-white/5 text-[#d4c9cd] hover:border-white/25",
                      )}
                    >
                      <option.icon className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <Accordion type="multiple" className="mt-3 space-y-2">
                <AccordionItem value="ducking" className="rounded-xl border border-white/15 bg-black/22 px-3">
                  <AccordionTrigger className="py-3 text-sm text-[#f5eee0] hover:no-underline">Ducking & Sidechain</AccordionTrigger>
                  <AccordionContent>
                    <SubtleToggle
                      checked={audioDuckingEnabled}
                      onCheckedChange={onAudioDuckingEnabledChange}
                      label="Auto voice ducking"
                      description="Lowers bed music under speech segments."
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="cleanup" className="rounded-xl border border-white/15 bg-black/22 px-3">
                  <AccordionTrigger className="py-3 text-sm text-[#f5eee0] hover:no-underline">Noise Cleanup</AccordionTrigger>
                  <AccordionContent>
                    <SubtleToggle
                      checked={audioCleanupEnabled}
                      onCheckedChange={onAudioCleanupEnabledChange}
                      label="Dialogue clarity"
                      description="Removes rumble and broad hiss with light denoise profile."
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="mastering" className="rounded-xl border border-white/15 bg-black/22 px-3">
                  <AccordionTrigger className="py-3 text-sm text-[#f5eee0] hover:no-underline">Mastering</AccordionTrigger>
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
