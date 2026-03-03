import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { Progress } from "@/components/ui/progress";
import { lazy, Suspense } from "react";
import GlowBackdrop from "@/components/GlowBackdrop";
const PricingCards = lazy(() => import("@/components/PricingCards"));
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Gauge, ScissorsSquare, Sparkles, Upload, Youtube, SquarePlay, Instagram, Music2, Podcast, TrendingUp, Eye, Timer, Rocket, Flame, Zap, Activity, Target, Radar, ChartNoAxesCombined, ScanLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/hooks/use-toast";

const ALLOWED_UPLOAD_EXTENSIONS = [".mp4", ".m4v", ".mkv"];
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "video/mp4",
  "application/mp4",
  "video/m4v",
  "video/x-m4v",
  "video/x-matroska",
]);

const transferHasFiles = (transfer: DataTransfer | null | undefined) => {
  if (!transfer) return false;
  if (transfer.files && transfer.files.length > 0) return true;
  if (!transfer.types) return false;
  return Array.from(transfer.types).includes("Files");
};

const getFirstTransferFile = (transfer: DataTransfer | null | undefined): File | null => {
  if (!transfer) return null;
  if (transfer.items && transfer.items.length > 0) {
    const fileItem = Array.from(transfer.items).find((item) => item.kind === "file");
    const maybeFile = fileItem?.getAsFile();
    if (maybeFile) return maybeFile;
  }
  return transfer.files?.[0] ?? null;
};

const isAllowedUploadFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  if (ALLOWED_UPLOAD_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) return true;
  const normalizedType = String(file.type || "").toLowerCase();
  return normalizedType.length > 0 && ALLOWED_UPLOAD_MIME_TYPES.has(normalizedType);
};

/* Upload CTA removed per request (Upload Raw Footage button) */

const demoSteps = [
  {
    title: "Upload long-form footage",
    detail: "Upload a real MP4, M4V, or MKV clip directly into this demo.",
    cue: "Drop a video to start the interactive pipeline",
    progress: 12,
    icon: Upload,
  },
  {
    title: "Process with Fake Editor",
    detail: "Simulate cut detection, pacing, and caption timing in one pass.",
    cue: "Fake Editor analyzing cuts and pacing rhythm",
    progress: 46,
    icon: Gauge,
  },
  {
    title: "Run Binge Optimizer",
    detail: "AI removes dead air, filler words, and low-retention sections.",
    cue: "Binge Optimizer boosting hook-to-hook flow",
    progress: 78,
    icon: ScissorsSquare,
  },
  {
    title: "Render final export",
    detail: "Generate creator-ready output with polished timing and framing.",
    cue: "Final render complete. Click Get Final Export",
    progress: 100,
    icon: CheckCircle2,
  },
] as const;

type DemoPipelinePhase = "idle" | "uploading" | "editing" | "optimizing" | "rendering" | "ready";

const demoPhaseProgress: Record<DemoPipelinePhase, number> = {
  idle: 12,
  uploading: 20,
  editing: 52,
  optimizing: 80,
  rendering: 94,
  ready: 100,
};

const demoPhaseCue: Record<DemoPipelinePhase, string> = {
  idle: demoSteps[0].cue,
  uploading: "Uploading source clip into the demo editor",
  editing: "Fake Editor simulating timeline trims and caption sync",
  optimizing: "Binge Optimizer removing low-retention beats",
  rendering: "Rendering final export preview",
  ready: "Final render complete. Click Get Final Export",
};

const formatUploadSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(0.1, mb).toFixed(1)} MB`;
  if (mb < 100) return `${mb.toFixed(1)} MB`;
  return `${Math.round(mb)} MB`;
};

const trialHoverBurstLines = [
  "Nothing is stopping you",
  "Stop procrastinating",
  "Go viral now",
  "Start today, not tomorrow",
  "Your timing is right now",
  "Being a creator is not hard",
  "Upload and post in minutes",
  "Make this your upload day",
  "Cut faster, grow faster",
  "Your next hit starts now",
  "Build momentum today",
  "Turn views into subscribers",
  "Ship content daily",
  "Make the algorithm notice",
  "Win the first 3 seconds",
  "Lock in your posting streak",
  "Consistency beats perfection",
  "Creators who post win",
  "Do not overthink. Publish.",
  "Hook harder. Retain longer.",
  "Your audience is waiting",
  "Push your next upload now",
  "Create now. Improve later.",
  "Stop delaying your growth",
  "One upload can change everything",
  "Binge-worthy edits only",
  "Go from raw clip to viral",
] as const;

const trialInnerThoughtPrompts = [
  "If this hook lands, watch time should spike.",
  "I can pull three Shorts out of this one video.",
  "Thumbnail, title, publish. Stop overthinking.",
  "The first five seconds need to hit harder.",
  "Posting tonight keeps my upload streak alive.",
  "This pacing feels right for YouTube retention.",
  "One caption pass and this is ready to ship.",
  "Done beats perfect. Publish and learn from it.",
  "This could be the clip that brings new subs.",
  "If I post now, the algorithm gets fresh signal.",
] as const;

const TRIAL_HOVER_TAKEOVER_DURATION_MS = 7_000;
const TRIAL_HOVER_TAKEOVER_DURATION_SECONDS = TRIAL_HOVER_TAKEOVER_DURATION_MS / 1000;
const TRIAL_INNER_THOUGHT_STAGGER_MS = 1_000;
const TRIAL_INNER_THOUGHT_POPUP_COUNT = 4;
const TRIAL_HOVER_TAKEOVER_DAILY_KEY = "trial_hover_takeover_last_date_v1";
const TRIAL_INNER_THOUGHT_MALE_VOICE_HINTS =
  /(guy|davis|david|matthew|michael|brian|daniel|james|thomas|alex|male|man|google uk english male)/i;
const TRIAL_INNER_THOUGHT_FEMALE_VOICE_HINTS =
  /(aria|jenny|sara|samantha|victoria|zira|karen|moira|allison|emma|ava|female|woman|google us english)/i;
type TrialInnerThoughtVoiceTone = "male" | "female";
const TRIAL_INNER_THOUGHT_WHISPER_PROFILES: Record<TrialInnerThoughtVoiceTone, ReadonlyArray<{ rate: number; pitch: number }>> = {
  male: [
    { rate: 0.72, pitch: 0.66 },
    { rate: 0.76, pitch: 0.74 },
  ],
  female: [
    { rate: 0.78, pitch: 1.02 },
    { rate: 0.82, pitch: 1.12 },
  ],
};

const pickDifferentPrompt = (prompts: readonly string[], previousPrompt: string) => {
  if (prompts.length === 0) return "";
  if (prompts.length === 1) return prompts[0];
  const currentIndex = Math.max(0, prompts.indexOf(previousPrompt));
  const offset = 1 + Math.floor(Math.random() * (prompts.length - 1));
  return prompts[(currentIndex + offset) % prompts.length];
};

const pickPromptSequence = (prompts: readonly string[], previousPrompt: string, count: number) => {
  if (prompts.length === 0 || count <= 0) return [];
  const pool = [...prompts.filter((prompt) => prompt !== previousPrompt)];
  if (pool.length === 0) pool.push(...prompts);

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  const sequence = pool.slice(0, count);
  while (sequence.length < count) {
    sequence.push(pickDifferentPrompt(prompts, sequence[sequence.length - 1] ?? previousPrompt));
  }
  return sequence;
};

const getTrialInnerThoughtVoicePools = (voices: SpeechSynthesisVoice[]) => {
  if (voices.length === 0) {
    return { male: [], female: [], fallback: [] } as {
      male: SpeechSynthesisVoice[];
      female: SpeechSynthesisVoice[];
      fallback: SpeechSynthesisVoice[];
    };
  }
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const candidateVoices = englishVoices.length > 0 ? englishVoices : voices;
  const sortedVoices = [...candidateVoices].sort((a, b) => {
    const aMan = TRIAL_INNER_THOUGHT_MALE_VOICE_HINTS.test(a.name) ? 1 : 0;
    const bMan = TRIAL_INNER_THOUGHT_MALE_VOICE_HINTS.test(b.name) ? 1 : 0;
    const aWoman = TRIAL_INNER_THOUGHT_FEMALE_VOICE_HINTS.test(a.name) ? 1 : 0;
    const bWoman = TRIAL_INNER_THOUGHT_FEMALE_VOICE_HINTS.test(b.name) ? 1 : 0;
    if (aMan !== bMan) return bMan - aMan;
    if (aWoman !== bWoman) return bWoman - aWoman;
    return a.name.localeCompare(b.name);
  });

  return {
    male: sortedVoices.filter((voice) => TRIAL_INNER_THOUGHT_MALE_VOICE_HINTS.test(voice.name)),
    female: sortedVoices.filter((voice) => TRIAL_INNER_THOUGHT_FEMALE_VOICE_HINTS.test(voice.name)),
    fallback: sortedVoices,
  };
};

const getLocalCalendarDayKey = () => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const hasDailyTrialHoverTakeoverBeenShown = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TRIAL_HOVER_TAKEOVER_DAILY_KEY) === getLocalCalendarDayKey();
  } catch {
    return false;
  }
};

const markDailyTrialHoverTakeoverShown = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRIAL_HOVER_TAKEOVER_DAILY_KEY, getLocalCalendarDayKey());
  } catch {
    // Ignore storage failures and keep behavior functional.
  }
};

const viralSignalCards = [
  {
    label: "View Velocity",
    stat: "+382%",
    detail: "first-hour views",
    Icon: TrendingUp,
    position: "left-[3%] top-[24%]",
  },
  {
    label: "Avg Watch Time",
    stat: "71%",
    detail: "after AI auto-cut",
    Icon: Eye,
    position: "right-[4%] top-[26%]",
  },
  {
    label: "Cut-to-Post",
    stat: "3m 42s",
    detail: "raw clip -> publish",
    Icon: Timer,
    position: "left-[8%] bottom-[24%]",
  },
  {
    label: "Viral Potential",
    stat: "A+",
    detail: "hook and pacing score",
    Icon: Rocket,
    position: "right-[10%] bottom-[20%]",
  },
] as const;

const viralTicker = [
  "Hook detection live",
  "Retention pacing AI",
  "Dead-air remover",
  "Instant captions",
  "Multi-platform exports",
  "Studio-grade presets",
] as const;

const heroViralBadges = [
  { label: "First-hour Views", stat: "+382%", position: "-left-10 top-1", visibility: "md:block" },
  { label: "Avg Watch Time", stat: "71%", position: "right-4 top-6", visibility: "md:block" },
  { label: "New Subs", stat: "+1.2k", position: "left-6 bottom-6", visibility: "md:block" },
  { label: "Subscriber Surge", stat: "+18%", position: "-left-7 top-24", visibility: "lg:block" },
  { label: "Views Today", stat: "3.4M", position: "right-8 bottom-5", visibility: "md:block" },
  { label: "Engagement", stat: "+48%", position: "-right-12 top-24", visibility: "lg:block" },
] as const;

const sideViralClips = [
  {
    title: "Viral Clip",
    views: "1.2M",
    subs: "+2.4k subs",
    pos: "right-[6%] top-[15%]",
    gradientClass: "from-primary/30 via-primary/10 to-transparent",
  },
  {
    title: "Series Clip",
    views: "768k",
    subs: "+1.5k subs",
    pos: "right-[7%] top-[42%]",
    gradientClass: "from-success/25 via-success/10 to-transparent",
  },
  {
    title: "Hook Clip",
    views: "482k",
    subs: "+910 subs",
    pos: "right-[10%] bottom-[18%]",
    gradientClass: "from-sky-300/25 via-sky-300/10 to-transparent",
  },
] as const;

const sideBingeOptimizerCards = [
  {
    title: "Binge Optimizer",
    status: "Live",
    stat: "Retention +32%",
    detail: "Auto-sequencing cliffhangers and re-hooks every 22s.",
    pos: "left-[4%] bottom-[18%]",
  },
] as const;

const topAnalyticsPanels = [
  {
    title: "Realtime Reach",
    value: "+12.4k",
    detail: "views in first hour",
    Icon: Activity,
    position: "left-[4%] top-[2.1rem]",
  },
  {
    title: "Hook Hold",
    value: "82%",
    detail: "viewers past 3 sec",
    Icon: Target,
    position: "right-[5%] top-[2.4rem]",
  },
  {
    title: "Trend Match",
    value: "94",
    detail: "niche momentum score",
    Icon: Radar,
    position: "left-[18%] top-[9.4rem]",
  },
  {
    title: "Clip Velocity",
    value: "3.1x",
    detail: "faster than last upload",
    Icon: ChartNoAxesCombined,
    position: "right-[18%] top-[9.8rem]",
  },
] as const;

const topBurstPoints = [
  "left-[12%] top-[4rem]",
  "left-[21%] top-[7rem]",
  "left-[33%] top-[5.8rem]",
  "left-[45%] top-[4.4rem]",
  "left-[56%] top-[6.2rem]",
  "left-[68%] top-[4.1rem]",
  "left-[79%] top-[7.2rem]",
  "left-[88%] top-[5.3rem]",
] as const;

const conversionStats = [
  { label: "From One Upload", value: "3+ publish-ready cuts" },
  { label: "Workflow Time", value: "Minutes, not hours" },
  { label: "Optimization Passes", value: "Hook + pacing + captions" },
  { label: "Output Targets", value: "YouTube + Shorts + Reels" },
] as const;

const objectionBreakers = [
  {
    title: "Spending hours trimming dead air?",
    detail: "AI removes filler words and low-retention moments in one pass so you stop hand-cutting every pause.",
  },
  {
    title: "Hard to repurpose one recording everywhere?",
    detail: "Turn one long-form clip into platform-ready formats with framing and pacing already tuned.",
  },
  {
    title: "Uploads feel inconsistent week to week?",
    detail: "Use the same creator presets and cadence each time so quality stays high even when volume increases.",
  },
] as const;

const confidenceBullets = [
  "Start free and test your real footage first",
  "No editing expertise required to get polished cuts",
  "Scale up only when publishing volume grows",
] as const;

const conversionPulseBars = Array.from({ length: 8 });

const ViralBackdrop = () => (
  <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,hsl(var(--primary)/0.24),transparent_40%),radial-gradient(circle_at_86%_22%,hsl(var(--glow-secondary)/0.2),transparent_42%),radial-gradient(circle_at_50%_88%,hsl(var(--primary)/0.13),transparent_44%)]" />

    <div className="absolute left-6 top-1/2 hidden md:block transform -translate-y-1/2 w-80">
      <div className="w-full px-2">
        <div className="relative">
          <motion.svg
            className="absolute left-0 top-6 h-32 w-full"
            viewBox="0 0 1200 260"
            preserveAspectRatio="none"
            initial={{ opacity: 0.18 }}
            animate={{ opacity: [0.12, 0.28, 0.12] }}
            transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.path
              d="M0,170 C120,120 220,205 340,150 C450,100 565,185 700,140 C830,95 940,190 1080,140 C1135,120 1168,135 1200,126"
              fill="none"
              stroke="hsl(var(--primary) / 0.5)"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0.2 }}
              animate={{ pathLength: [0.2, 1, 0.2], strokeOpacity: [0.24, 0.58, 0.24] }}
              transition={{ duration: 6.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.path
              d="M0,198 C140,156 250,220 368,176 C490,128 615,212 742,170 C868,126 975,208 1102,164 C1146,148 1178,156 1200,149"
              fill="none"
              stroke="hsl(var(--glow-secondary) / 0.48)"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0.15 }}
              animate={{ pathLength: [0.15, 1, 0.15], strokeOpacity: [0.15, 0.48, 0.15] }}
              transition={{ duration: 7.1, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
            />
            <motion.circle
              cx="940"
              cy="190"
              r="6"
              fill="hsl(var(--primary) / 0.75)"
              animate={{ cy: [190, 162, 190], opacity: [0.35, 0.8, 0.35] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.circle
              cx="560"
              cy="212"
              r="5"
              fill="hsl(var(--glow-secondary) / 0.72)"
              animate={{ cy: [212, 178, 212], opacity: [0.26, 0.74, 0.26] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            />
          </motion.svg>

          <motion.div
            className="relative w-full rounded-2xl border border-primary/35 bg-card/35 p-3.5 backdrop-blur-md shadow-[0_20px_45px_-28px_hsl(var(--primary)/0.9)]"
            animate={{ y: [0, -5, 0], opacity: [0.5, 0.82, 0.5] }}
            transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <ScanLine className="h-3.5 w-3.5" />
                </span>
                Viral Analytics Live
              </div>
              <span className="rounded-full border border-success/40 bg-success/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                Retention signal active
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <motion.div
                className="rounded-xl border border-border/50 bg-background/55 p-2.5"
                animate={{ borderColor: ["hsl(var(--border) / 0.5)", "hsl(var(--primary) / 0.4)", "hsl(var(--border) / 0.5)"] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Viral Index</p>
                <p className="mt-1 text-sm font-semibold text-foreground">89 / 100</p>
              </motion.div>
              <motion.div
                className="rounded-xl border border-border/50 bg-background/55 p-2.5"
                animate={{ borderColor: ["hsl(var(--border) / 0.5)", "hsl(var(--glow-secondary) / 0.38)", "hsl(var(--border) / 0.5)"] }}
                transition={{ duration: 3.1, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Watch Lift</p>
                <p className="mt-1 text-sm font-semibold text-foreground">+37%</p>
              </motion.div>
              <motion.div
                className="rounded-xl border border-border/50 bg-background/55 p-2.5"
                animate={{ borderColor: ["hsl(var(--border) / 0.5)", "hsl(var(--primary) / 0.4)", "hsl(var(--border) / 0.5)"] }}
                transition={{ duration: 2.9, repeat: Infinity, ease: "easeInOut", delay: 0.65 }}
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Hook Score</p>
                <p className="mt-1 text-sm font-semibold text-foreground">A+</p>
              </motion.div>
            </div>
          </motion.div>

          {topAnalyticsPanels.map((panel, index) => (
            <motion.div
              key={panel.title}
              className={`absolute ${panel.position}`}
              animate={{ y: [0, -8, 0], opacity: [0.3, 0.62, 0.3] }}
              transition={{ duration: 3.1 + index * 0.45, repeat: Infinity, ease: "easeInOut", delay: index * 0.3 }}
            >
              <div className="rounded-xl border border-border/50 bg-card/30 p-2.5 backdrop-blur-sm shadow-[0_12px_30px_-20px_hsl(var(--primary)/0.8)]">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20 text-primary">
                    <panel.Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="text-left">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{panel.title}</p>
                    <p className="text-xs font-semibold text-foreground">{panel.value}</p>
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">{panel.detail}</p>
              </div>
            </motion.div>
          ))}

          {topBurstPoints.map((position, index) => (
            <motion.span
              key={position}
              className={`absolute ${position} h-2 w-2 rounded-full bg-primary/70`}
              animate={{ scale: [0.65, 1.5, 0.65], opacity: [0.2, 0.86, 0.2] }}
              transition={{ duration: 1.9 + (index % 3) * 0.4, repeat: Infinity, ease: "easeInOut", delay: index * 0.2 }}
            />
          ))}
        </div>
      </div>
    </div>

    <motion.div
      className="absolute left-[14%] top-[22%] h-64 w-64 rounded-full border border-primary/20"
      animate={{ scale: [0.9, 1.05, 0.9], opacity: [0.15, 0.34, 0.15] }}
      transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute right-[12%] top-[20%] h-52 w-52 rounded-full border border-sky-300/20"
      animate={{ scale: [1.05, 0.88, 1.05], opacity: [0.18, 0.35, 0.18] }}
      transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
    />
    <motion.div
      className="absolute right-[21%] bottom-[16%] h-72 w-72 rounded-full border border-primary/15"
      animate={{ scale: [0.95, 1.08, 0.95], opacity: [0.12, 0.26, 0.12] }}
      transition={{ duration: 7.4, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
    />

    {viralSignalCards.map((signal, index) => (
      <motion.div
        key={signal.label}
        className={`absolute hidden md:block ${signal.position}`}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: [0.24, 0.72, 0.24], y: [0, -13, 0], scale: [0.98, 1.03, 0.98] }}
        transition={{
          opacity: { delay: 0.4 + index * 0.2, duration: 0.9 },
          y: { duration: 2.8 + index * 0.4, repeat: Infinity, ease: "easeInOut", delay: index * 0.2 },
          scale: { duration: 2.8 + index * 0.4, repeat: Infinity, ease: "easeInOut", delay: index * 0.2 },
        }}
      >
        <div className="rounded-2xl border border-border/45 bg-card/28 p-3 backdrop-blur-sm shadow-[0_8px_30px_-18px_hsl(var(--primary)/0.6)]">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <signal.Icon className="h-4 w-4" />
            </span>
            <div className="text-left">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">{signal.label}</p>
              <p className="text-sm font-semibold text-foreground">{signal.stat}</p>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{signal.detail}</p>
        </div>
      </motion.div>
    ))}

    {/* Side viral clip animations */}
    {sideViralClips.map((clip, idx) => (
      <motion.div
        key={clip.title}
        className={`absolute ${clip.pos} hidden lg:block`}
        initial={{ opacity: 0, y: 18, scale: 0.94 }}
        animate={{ opacity: [0.2, 1, 0.2], y: [0, -16, 0], scale: [0.94, 1.08, 0.94], rotate: [0, -0.9, 0.9, 0] }}
        transition={{ duration: 2.9 + idx * 0.35, repeat: Infinity, ease: "easeInOut", delay: idx * 0.24 }}
      >
        <div className="w-44 rounded-xl border border-border/45 bg-card/30 p-2 shadow-[0_12px_30px_-18px_hsl(var(--primary)/0.6)]">
          <div className="relative mb-2 h-24 overflow-hidden rounded-md bg-muted/30">
            <div className={`absolute inset-0 bg-gradient-to-br ${clip.gradientClass}`} />
            <div className="absolute inset-0 flex items-center justify-center">
              <SquarePlay className="h-8 w-8 text-foreground/90" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-foreground">{clip.title}</p>
              <p className="text-[11px] text-muted-foreground">{clip.views} views</p>
              <p className="text-[11px] font-medium text-primary/95">{clip.subs}</p>
            </div>
            <motion.div
              className="flex items-center gap-1 rounded-full bg-success/8 px-2 py-0.5 text-[11px] font-semibold text-success"
              animate={{ scale: [1, 1.06, 1], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: idx * 0.25 }}
            >
              🔥 Viral
            </motion.div>
          </div>
        </div>
      </motion.div>
    ))}

    {sideBingeOptimizerCards.map((card, idx) => (
      <motion.div
        key={card.title}
        className={`absolute ${card.pos} hidden xl:block`}
        initial={{ opacity: 0, x: -14, scale: 0.95 }}
        animate={{ opacity: [0.26, 0.98, 0.26], x: [0, 6, 0], y: [0, -10, 0], scale: [0.96, 1.03, 0.96] }}
        transition={{ duration: 3 + idx * 0.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-56 rounded-2xl border border-primary/35 bg-card/38 p-3 backdrop-blur-md shadow-[0_16px_35px_-20px_hsl(var(--primary)/0.75)]">
          <div className="mb-2 flex items-center justify-between">
            <div className="inline-flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/20 text-primary">
                <ScissorsSquare className="h-4 w-4" />
              </span>
              <p className="text-xs font-semibold text-foreground">{card.title}</p>
            </div>
            <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
              {card.status}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">{card.stat}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{card.detail}</p>
          <div className="mt-3 overflow-hidden rounded-full bg-background/70">
            <motion.span
              className="block h-1.5 rounded-full bg-primary/90"
              animate={{ width: ["42%", "88%", "42%"] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </div>
      </motion.div>
    ))}

    <div className="absolute left-[7%] top-[42%] hidden md:block">
      <motion.div
        className="inline-flex items-center gap-2 rounded-full border border-success/35 bg-success/10 px-3 py-1 text-[11px] font-semibold text-success"
        animate={{ opacity: [0.5, 0.95, 0.5], scale: [1, 1.06, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <Flame className="h-3.5 w-3.5" />
        Trending spike detected
      </motion.div>
    </div>

    <div className="absolute right-[9%] top-[46%] hidden md:block">
      <motion.div
        className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/12 px-3 py-1 text-[11px] font-semibold text-primary"
        animate={{ opacity: [0.45, 0.88, 0.45], scale: [1, 1.05, 1] }}
        transition={{ duration: 3.1, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
      >
        <Zap className="h-3.5 w-3.5" />
        Hook score climbing
      </motion.div>
    </div>

    <div className="absolute inset-x-0 bottom-7 hidden overflow-hidden md:block">
      <motion.div
        className="flex w-max gap-2 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
      >
        {[...viralTicker, ...viralTicker].map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="rounded-full border border-border/45 bg-card/35 px-3 py-1 text-[11px] font-medium text-muted-foreground/90"
          >
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  </div>
);

const Index = () => {
  const [activeDemoStep, setActiveDemoStep] = useState(0);
  const [isTrialHoverTakeoverActive, setIsTrialHoverTakeoverActive] = useState(false);
  const [trialHoverTakeoverCycle, setTrialHoverTakeoverCycle] = useState(0);
  const [isTrialCtaHovered, setIsTrialCtaHovered] = useState(false);
  const [isTrialHolyGlowReady, setIsTrialHolyGlowReady] = useState(false);
  const [isTrialGoldenActive, setIsTrialGoldenActive] = useState(false);
  const [activeTrialInnerThoughtPrompt, setActiveTrialInnerThoughtPrompt] = useState<string>(trialInnerThoughtPrompts[0]);
  const [activeTrialInnerThoughtPrompts, setActiveTrialInnerThoughtPrompts] = useState<string[]>([trialInnerThoughtPrompts[0]]);
  const [demoPhase, setDemoPhase] = useState<DemoPipelinePhase>("idle");
  const [demoUploadFile, setDemoUploadFile] = useState<File | null>(null);
  const [demoUploadUrl, setDemoUploadUrl] = useState<string | null>(null);
  const [showDemoSignupPopup, setShowDemoSignupPopup] = useState(false);
  const [isDemoDragging, setIsDemoDragging] = useState(false);
  const [trialHoverTakeoverAvailableToday, setTrialHoverTakeoverAvailableToday] = useState(
    () => !hasDailyTrialHoverTakeoverBeenShown()
  );
  const trialHoverTakeoverTimerRef = useRef<number | null>(null);
  const trialInnerThoughtTimersRef = useRef<number[]>([]);
  const isTrialHoverTakeoverActiveRef = useRef(false);
  const trialInnerThoughtVoiceCursorRef = useRef(0);
  const trialInnerThoughtToneCursorRef = useRef(0);
  const holyHoverAudioContextRef = useRef<AudioContext | null>(null);
  const holyHoverSoundPlayedForCurrentHoverRef = useRef(false);
  const demoUploadInputRef = useRef<HTMLInputElement | null>(null);
  const demoPipelineTimersRef = useRef<number[]>([]);
  const demoDragDepthRef = useRef(0);
  const shouldReduceMotion = useReducedMotion();
  const { toast } = useToast();

  // Defer mounting heavy backdrop until idle/after first paint to speed initial load
  const [showBackdrop, setShowBackdrop] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = (window as any).requestIdleCallback
      ? (window as any).requestIdleCallback(() => setShowBackdrop(true))
      : window.setTimeout(() => setShowBackdrop(true), 600);
    return () => {
      if ((window as any).cancelIdleCallback) (window as any).cancelIdleCallback(handle);
      else clearTimeout(handle as number);
    };
  }, []);

  // Check document-level performance flag set earlier to avoid heavy animations
  const isPerformanceConstrained = typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-performance") === "constrained";

  // Detect low-power / low-capacity devices and toggle performance flags
  useEffect(() => {
    try {
      const docEl = document.documentElement;
      // Add class to reduce or remove CSS animation delays immediately
      docEl.classList.add("no-animation-delays");

      const hwConcurrency = (navigator as any).hardwareConcurrency || 4;
      const deviceMemory = (navigator as any).deviceMemory || 4;
      if (hwConcurrency <= 2 || (deviceMemory && deviceMemory <= 1)) {
        docEl.setAttribute("data-performance", "constrained");
      }

      // Also optimize for small viewports (mobile)
      if (window.innerWidth <= 767) {
        docEl.setAttribute("data-performance", "constrained");
      }
    } catch (e) {
      // ignore
    }
  }, []);
 
  const creatorPlatforms = [
    { name: "YouTube", Icon: Youtube },
    { name: "YouTube Shorts", Icon: SquarePlay },
    { name: "Instagram Reels", Icon: Instagram },
    { name: "TikTok", Icon: Music2 },
    { name: "Podcasts", Icon: Podcast },
  ] as const;

  const proofCards = [
    {
      icon: Sparkles,
      title: "Built for creator workflows",
      stat: "1 recording -> multi-platform cuts",
      detail: "Turn one long video into ready-to-post clips across your channel stack.",
    },
    {
      icon: ScissorsSquare,
      title: "Retention-first editing",
      stat: "Hooks, trims, and pacing in one pass",
      detail: "Keep viewers watching longer with cuts tuned for creator content cadence.",
    },
    {
      icon: Gauge,
      title: "Scale your upload schedule",
      stat: "From solo channel to creator team",
      detail: "Grow from occasional uploads to daily publishing with higher render volume.",
    },
  ];

  const clearDemoPipelineTimers = useCallback(() => {
    demoPipelineTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    demoPipelineTimersRef.current = [];
  }, []);

  const clearTrialHoverTakeoverTimer = useCallback(() => {
    if (trialHoverTakeoverTimerRef.current !== null) {
      window.clearTimeout(trialHoverTakeoverTimerRef.current);
      trialHoverTakeoverTimerRef.current = null;
    }
  }, []);

  const clearTrialInnerThoughtTimers = useCallback(() => {
    trialInnerThoughtTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    trialInnerThoughtTimersRef.current = [];
  }, []);

  const primeHolyHoverAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return;

    const context = holyHoverAudioContextRef.current ?? new AudioContextConstructor();
    holyHoverAudioContextRef.current = context;
    if (context.state === "suspended") void context.resume();
  }, []);

  const playHolyHoverChime = useCallback(() => {
    primeHolyHoverAudio();
    const context = holyHoverAudioContextRef.current;
    if (!context) return;

    const now = context.currentTime + 0.01;
    const masterGain = context.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.22, now + 0.05);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);
    masterGain.connect(context.destination);

    const holyChord = [523.25, 659.25, 783.99] as const;
    holyChord.forEach((frequency, index) => {
      const startAt = now + index * 0.06;
      const endAt = startAt + 1.35;

      const bodyOscillator = context.createOscillator();
      const bodyGain = context.createGain();
      bodyOscillator.type = "sine";
      bodyOscillator.frequency.setValueAtTime(frequency, startAt);
      bodyOscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, endAt);
      bodyGain.gain.setValueAtTime(0.0001, startAt);
      bodyGain.gain.exponentialRampToValueAtTime(0.16 / (index + 1), startAt + 0.12);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, endAt);

      const shimmerOscillator = context.createOscillator();
      const shimmerGain = context.createGain();
      shimmerOscillator.type = "triangle";
      shimmerOscillator.frequency.setValueAtTime(frequency * 2, startAt);
      shimmerOscillator.frequency.exponentialRampToValueAtTime(frequency * 2.4, endAt);
      shimmerGain.gain.setValueAtTime(0.0001, startAt);
      shimmerGain.gain.exponentialRampToValueAtTime(0.06 / (index + 1), startAt + 0.08);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, endAt);

      bodyOscillator.connect(bodyGain);
      shimmerOscillator.connect(shimmerGain);
      bodyGain.connect(masterGain);
      shimmerGain.connect(masterGain);

      bodyOscillator.start(startAt);
      shimmerOscillator.start(startAt + 0.02);
      bodyOscillator.stop(endAt);
      shimmerOscillator.stop(endAt);
    });

    window.setTimeout(() => {
      masterGain.disconnect();
    }, 2200);
  }, [primeHolyHoverAudio]);

  const speakTrialInnerThoughtPrompt = useCallback((prompt: string, tone: TrialInnerThoughtVoiceTone, options?: { interrupt?: boolean }) => {
    // Legacy per-prompt speech function left in place but no longer invoked by inner-thoughts.
    // We keep this available for future use but it will not be called automatically.
    if (!isTrialHoverTakeoverActiveRef.current) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    if (options?.interrupt) synth.cancel();
    const utterance = new SpeechSynthesisUtterance(prompt);
    utterance.lang = "en-US";
    utterance.volume = 0.32;

    const voicePools = getTrialInnerThoughtVoicePools(synth.getVoices());
    const preferredVoices = tone === "male" ? voicePools.male : voicePools.female;
    const backupVoices = tone === "male" ? voicePools.female : voicePools.male;
    const voicePool = preferredVoices.length > 0 ? preferredVoices : backupVoices.length > 0 ? backupVoices : voicePools.fallback;

    if (voicePool.length > 0) {
      const voiceIndex = trialInnerThoughtVoiceCursorRef.current % voicePool.length;
      const selectedVoice = voicePool[voiceIndex];
      utterance.voice = selectedVoice;
      trialInnerThoughtVoiceCursorRef.current = voiceIndex + 1;
    }

    const whisperProfiles = TRIAL_INNER_THOUGHT_WHISPER_PROFILES[tone];
    const whisperProfile = whisperProfiles[trialInnerThoughtVoiceCursorRef.current % whisperProfiles.length];
    utterance.rate = whisperProfile.rate;
    utterance.pitch = whisperProfile.pitch;
    synth.speak(utterance);
  }, []);

  // Speak a single short message when the hover takeover begins.
  const speakSingleHoverMessage = useCallback((options?: { interrupt?: boolean }) => {
    if (shouldReduceMotion) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    if (options?.interrupt) synth.cancel();

    const messages = [
      "AutoEditor can help increase your retention by optimizing hooks and pacing.",
      "Upload now — faster edits mean more consistent growth.",
      "Keep viewers longer: smarter cuts, better hooks.",
      "One upload can become multiple publish-ready clips.",
      "Ship the clip — learn and iterate. Consistency wins.",
    ];
    const message = messages[Math.floor(Math.random() * messages.length)];
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "en-US";
    utterance.volume = 0.9;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    synth.speak(utterance);
  }, [shouldReduceMotion]);

  // Automatically enable a golden CTA state after 5 seconds
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = window.setTimeout(() => setIsTrialGoldenActive(true), 5000);
    return () => window.clearTimeout(t);
  }, []);

  const triggerTrialHoverTakeover = useCallback(() => {
    if (shouldReduceMotion) return;
    if (!trialHoverTakeoverAvailableToday) return;
    const promptSequence = pickPromptSequence(
      trialInnerThoughtPrompts,
      activeTrialInnerThoughtPrompt,
      TRIAL_INNER_THOUGHT_POPUP_COUNT,
    );
    const firstPrompt = promptSequence[0] ?? trialInnerThoughtPrompts[0];
    // Show all selected inner-thought prompts immediately (no stagger delay)
    setActiveTrialInnerThoughtPrompt(firstPrompt);
    setActiveTrialInnerThoughtPrompts(promptSequence);
    setTrialHoverTakeoverCycle((current) => current + 1);
    setIsTrialHolyGlowReady(false);
    holyHoverSoundPlayedForCurrentHoverRef.current = false;
    isTrialHoverTakeoverActiveRef.current = true;
    setIsTrialHoverTakeoverActive(true);
    markDailyTrialHoverTakeoverShown();
    setTrialHoverTakeoverAvailableToday(false);
    // Do not speak per inner-thought prompts. Instead speak a single short message once on takeover start.
    speakSingleHoverMessage({ interrupt: true });
    clearTrialInnerThoughtTimers();
    // No stagger timers: we already displayed prompts immediately.
    trialInnerThoughtTimersRef.current = [];
    clearTrialHoverTakeoverTimer();
    trialHoverTakeoverTimerRef.current = window.setTimeout(() => {
      isTrialHoverTakeoverActiveRef.current = false;
      setIsTrialHoverTakeoverActive(false);
      setIsTrialHolyGlowReady(true);
      if (isTrialCtaHovered && !holyHoverSoundPlayedForCurrentHoverRef.current) {
        playHolyHoverChime();
        holyHoverSoundPlayedForCurrentHoverRef.current = true;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      clearTrialInnerThoughtTimers();
      trialHoverTakeoverTimerRef.current = null;
    }, TRIAL_HOVER_TAKEOVER_DURATION_MS);
  }, [
    activeTrialInnerThoughtPrompt,
    clearTrialInnerThoughtTimers,
    clearTrialHoverTakeoverTimer,
    isTrialCtaHovered,
    playHolyHoverChime,
    shouldReduceMotion,
    speakSingleHoverMessage,
    trialHoverTakeoverAvailableToday,
  ]);

  const handleTrialCtaHoverStart = useCallback(() => {
    setIsTrialCtaHovered(true);
    holyHoverSoundPlayedForCurrentHoverRef.current = false;
    primeHolyHoverAudio();
    if (isTrialHolyGlowReady && !isTrialHoverTakeoverActive && !holyHoverSoundPlayedForCurrentHoverRef.current) {
      playHolyHoverChime();
      holyHoverSoundPlayedForCurrentHoverRef.current = true;
    }
    triggerTrialHoverTakeover();
  }, [isTrialHolyGlowReady, isTrialHoverTakeoverActive, playHolyHoverChime, primeHolyHoverAudio, triggerTrialHoverTakeover]);

  const handleTrialCtaHoverEnd = useCallback(() => {
    setIsTrialCtaHovered(false);
    holyHoverSoundPlayedForCurrentHoverRef.current = false;
    // If takeover is not active, stop any speech immediately to avoid lingering audio.
    if (!isTrialHoverTakeoverActiveRef.current && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const runDemoPipeline = useCallback(() => {
    clearDemoPipelineTimers();
    const scheduledStages: Array<{ delay: number; phase: DemoPipelinePhase; step: number }> = [
      { delay: 1200, phase: "editing", step: 1 },
      { delay: 3000, phase: "optimizing", step: 2 },
      { delay: 5000, phase: "rendering", step: 3 },
      { delay: 6800, phase: "ready", step: 3 },
    ];
    demoPipelineTimersRef.current = scheduledStages.map(({ delay, phase, step }) =>
      window.setTimeout(() => {
        setDemoPhase(phase);
        setActiveDemoStep(step);
      }, delay),
    );
  }, [clearDemoPipelineTimers]);

  const handleDemoFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      if (!isAllowedUploadFile(file)) {
        toast({ title: "Unsupported file type", description: "Upload an MP4, M4V, or MKV video file." });
        return;
      }
      const fileUrl = URL.createObjectURL(file);
      setDemoUploadUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return fileUrl;
      });
      setDemoUploadFile(file);
      setShowDemoSignupPopup(false);
      setDemoPhase("uploading");
      setActiveDemoStep(0);
      runDemoPipeline();
    },
    [runDemoPipeline, toast],
  );

  const handleDemoUploadClick = useCallback(() => {
    demoUploadInputRef.current?.click();
  }, []);

  const handleDemoUploadInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    handleDemoFile(file);
    event.currentTarget.value = "";
  }, [handleDemoFile]);

  const handleDemoDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!transferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    demoDragDepthRef.current += 1;
    setIsDemoDragging(true);
  }, []);

  const handleDemoDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!transferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    if (!isDemoDragging) setIsDemoDragging(true);
  }, [isDemoDragging]);

  const handleDemoDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!transferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    demoDragDepthRef.current = Math.max(0, demoDragDepthRef.current - 1);
    if (demoDragDepthRef.current === 0) setIsDemoDragging(false);
  }, []);

  const handleDemoDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!transferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    demoDragDepthRef.current = 0;
    setIsDemoDragging(false);
    const file = getFirstTransferFile(event.dataTransfer);
    handleDemoFile(file);
  }, [handleDemoFile]);

  const handleDemoReset = useCallback(() => {
    clearDemoPipelineTimers();
    setDemoPhase("idle");
    setDemoUploadFile(null);
    setShowDemoSignupPopup(false);
    setActiveDemoStep(0);
    setIsDemoDragging(false);
    demoDragDepthRef.current = 0;
    setDemoUploadUrl((previousUrl) => {
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      return null;
    });
  }, [clearDemoPipelineTimers]);

  const handleDemoPrimaryAction = useCallback(() => {
    if (demoPhase === "ready") {
      setShowDemoSignupPopup(true);
      return;
    }
    handleDemoUploadClick();
  }, [demoPhase, handleDemoUploadClick]);

  useEffect(() => {
    return () => clearDemoPipelineTimers();
  }, [clearDemoPipelineTimers]);

  useEffect(() => {
    return () => clearTrialHoverTakeoverTimer();
  }, [clearTrialHoverTakeoverTimer]);

  useEffect(() => {
    return () => clearTrialInnerThoughtTimers();
  }, [clearTrialInnerThoughtTimers]);

  useEffect(() => {
    isTrialHoverTakeoverActiveRef.current = isTrialHoverTakeoverActive;
    if (!isTrialHoverTakeoverActive && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [isTrialHoverTakeoverActive]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (demoUploadUrl) URL.revokeObjectURL(demoUploadUrl);
    };
  }, [demoUploadUrl]);

  useEffect(() => {
    return () => {
      if (holyHoverAudioContextRef.current) {
        const context = holyHoverAudioContextRef.current;
        holyHoverAudioContextRef.current = null;
        void context.close().catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    if (demoPhase !== "idle" || demoUploadFile) return;
    // Skip demo RAF loop on low-power / constrained devices
    if (isPerformanceConstrained) return;
    let rafId = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      // Pause advancing when tab is hidden to save CPU
      if (document.hidden) {
        last = now;
        rafId = requestAnimationFrame(tick);
        return;
      }
      acc += now - last;
      if (acc >= 2200) {
        setActiveDemoStep((current) => (current + 1) % demoSteps.length);
        acc = 0;
      }
      last = now;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [demoPhase, demoUploadFile]);

  const activeDemo = demoSteps[activeDemoStep];
  const activeDemoProgress = demoPhase === "idle" ? activeDemo.progress : demoPhaseProgress[demoPhase];
  const activeDemoCue =
    demoPhase === "uploading" && demoUploadFile
      ? `Uploading ${demoUploadFile.name} into the fake editor`
      : demoPhase === "idle"
        ? activeDemo.cue
        : demoPhaseCue[demoPhase];
  const isTrialHolyGlowActive =
    isTrialCtaHovered && !isTrialHoverTakeoverActive && isTrialHolyGlowReady && !shouldReduceMotion;
  const isDemoProcessing = demoPhase !== "idle" && demoPhase !== "ready";
  const demoPrimaryActionLabel =
    demoPhase === "ready"
      ? "Get Final Export"
      : demoPhase === "uploading"
        ? "Uploading Video..."
        : demoPhase === "editing"
          ? "Running Fake Editor..."
          : demoPhase === "optimizing"
            ? "Running Binge Optimizer..."
            : demoPhase === "rendering"
              ? "Rendering Final Output..."
              : "Upload";

  return (
    <GlowBackdrop>
        <div className="relative min-h-screen overflow-hidden">
          <div className="relative z-10">
            <Navbar />
            <main className="responsive-main relative min-h-screen overflow-hidden px-4 pt-24 pb-24">
        {showBackdrop && !isPerformanceConstrained ? <ViralBackdrop /> : null}
        <AnimatePresence>
          {isTrialHoverTakeoverActive ? (
            <>
              <motion.div
                className="pointer-events-none absolute inset-0 z-20 bg-background/30 backdrop-blur-[4px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
              <motion.div
                key={`trial-hover-overlay-${trialHoverTakeoverCycle}`}
                className="pointer-events-none absolute inset-x-0 top-[14rem] z-30 flex justify-center sm:top-[18rem]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <div className="relative h-[19rem] w-[min(52rem,94vw)] sm:h-[24rem]">
                  <motion.div
                    className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-3xl"
                    initial={{ opacity: 0, scale: 0.62 }}
                    animate={{ opacity: [0, 0.72, 0], scale: [0.62, 1.26, 1.55] }}
                    transition={{ duration: TRIAL_HOVER_TAKEOVER_DURATION_SECONDS * 0.9, ease: "easeOut" }}
                  />
                  <motion.span
                    className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/55"
                    initial={{ opacity: 0.72, scale: 0.7 }}
                    animate={{ opacity: 0, scale: 2.2 }}
                    transition={{ duration: TRIAL_HOVER_TAKEOVER_DURATION_SECONDS * 0.76, ease: "easeOut" }}
                  />
                  <motion.span
                    className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-glow-secondary/45"
                    initial={{ opacity: 0.64, scale: 0.58 }}
                    animate={{ opacity: 0, scale: 2.05 }}
                    transition={{ duration: TRIAL_HOVER_TAKEOVER_DURATION_SECONDS * 0.8, ease: "easeOut", delay: 0.18 }}
                  />
                  {activeTrialInnerThoughtPrompts.map((prompt, index) => {
                    const count = activeTrialInnerThoughtPrompts.length;
                    const angle = ((index + 1) / (count + 1)) * Math.PI * 2;
                    const radiusX = 220 + (index % 3) * 90;
                    const radiusY = 120 + (index % 4) * 70;
                    const targetX = Math.cos(angle) * radiusX;
                    const targetY = Math.sin(angle) * radiusY - 40;

                    return (
                      <motion.div
                        key={`inner-thought-${trialHoverTakeoverCycle}-${index}-${prompt}`}
                        className="absolute left-1/2 top-1/2 w-[min(17rem,88vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-primary/45 bg-card/88 px-3 py-3 text-center backdrop-blur-xl shadow-[0_24px_54px_-34px_hsl(var(--primary)/0.95)] inner-thought sm:w-[min(20rem,78vw)] sm:px-4"
                        style={{ zIndex: 20 + index }}
                        initial={{ opacity: 0, scale: 0.9, x: 0, y: 0 }}
                        animate={{
                          x: [0, targetX, targetX + (index % 2 === 0 ? 8 : -8)],
                          y: [0, targetY, targetY],
                          opacity: [0, 1, 1, 0],
                          scale: [0.98, 1.02, 1.0],
                        }}
                        transition={{ duration: TRIAL_HOVER_TAKEOVER_DURATION_SECONDS, ease: "easeInOut" }}
                      >
                        <motion.div
                          initial={{ y: 0 }}
                          animate={{ y: [0, -6, 6, -6, 0] }}
                          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/85">Inner thought</p>
                          <p className="mt-1 text-sm font-semibold leading-snug text-foreground sm:text-base">{prompt}</p>
                        </motion.div>
                      </motion.div>
                    );
                  })}
                  {trialHoverBurstLines.map((line, index) => {
                    const angle = (index / trialHoverBurstLines.length) * Math.PI * 2;
                    const radiusX = 174 + (index % 4) * 30;
                    const radiusY = 88 + (index % 5) * 20;
                    const targetX = Math.cos(angle) * radiusX;
                    const targetY = Math.sin(angle) * radiusY;
                    const driftX = (index % 2 === 0 ? 1 : -1) * (8 + (index % 3) * 2);
                    const driftY = 8 + (index % 4) * 2;
                    const rotatePeak = index % 3 === 0 ? 8 : -8;

                    return (
                      <motion.span
                        key={`${line}-${index}-${trialHoverTakeoverCycle}`}
                        className="absolute left-1/2 top-1/2 hidden max-w-[84vw] -translate-x-1/2 rounded-full border border-primary/40 bg-gradient-to-br from-card/85 via-card/70 to-primary/20 px-3 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-foreground shadow-[0_18px_34px_-24px_hsl(var(--primary)/0.92)] backdrop-blur-md sm:inline-flex"
                        initial={{ x: 0, y: 0, scale: 0.72, opacity: 0 }}
                        animate={{
                          x: [0, targetX, targetX + driftX],
                          y: [0, targetY, targetY - driftY],
                          rotate: [0, rotatePeak, 0],
                          scale: [0.72, 1.05, 0.98],
                          opacity: [0, 1, 1, 0],
                        }}
                        transition={{
                          duration: TRIAL_HOVER_TAKEOVER_DURATION_SECONDS * 0.92,
                          ease: [0.2, 0.82, 0.24, 1],
                          delay: (index % 9) * 0.045,
                        }}
                      >
                        {line}
                      </motion.span>
                    );
                  })}
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
        <div className={`relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center ${isTrialHoverTakeoverActive ? 'trial-takeover-active' : ''}`}>
          {/* Hero */}
          <motion.div
            className="mx-auto flex w-full max-w-3xl flex-col items-center text-center anim-perf"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <motion.div
              className="pill-badge mb-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              FOR YOUTUBERS & CREATORS
            </motion.div>

            <motion.div
              className="relative mb-6 w-full"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
            >
              <div className="pointer-events-none absolute -inset-x-6 -inset-y-10 hidden sm:block">
                <span className="hero-copy-orb hero-copy-orb-left" />
                <span className="hero-copy-orb hero-copy-orb-right" />
              </div>

              <motion.h1
                className="hero-title-stack relative text-4xl font-bold font-display leading-[1.1] tracking-tight text-foreground sm:text-6xl lg:text-7xl"
                whileHover={shouldReduceMotion ? undefined : { y: -2, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 280, damping: 18 }}
              >
                <motion.span
                  className="hero-title-line block"
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.34, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                >
                  Your Videos Don't Need More Effort.
                </motion.span>
                <motion.span
                  className="hero-highlight-text block"
                  initial={{ opacity: 0, y: 26 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.44, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                >
                  They Need Smarter Editing.
                </motion.span>
              </motion.h1>

              <motion.span
                className="hero-focus-line mx-auto mt-4 block h-px w-[min(22rem,72vw)] rounded-full"
                initial={{ opacity: 0, scaleX: 0.4 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: 0.56, duration: 0.6, ease: "easeOut" }}
              />

              {/* Subtle side animations around hero title (left & right) - hidden on small screens */}
              <motion.div
                className="hidden md:block absolute -left-6 top-12 h-6 w-6 rounded-full bg-gradient-to-br from-primary/70 to-glow-secondary/40"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: [0, 0.9, 0.3], y: [0, -6, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              />

              <motion.div
                className="hidden md:block absolute -right-6 top-14 h-5 w-5 rounded-full bg-primary/30"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: [0, 0.85, 0.2], y: [0, -4, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              />

              {/* Hero floating viral badges */}
              {heroViralBadges.map((badge, idx) => (
                <motion.div
                  key={badge.label}
                  className={`absolute ${badge.position} hidden ${badge.visibility || "sm:block"}`}
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: [0.22, 0.98, 0.22], y: [0, -12, 0], scale: [0.96, 1.08, 0.96] }}
                  transition={{ duration: 2.4 + idx * 0.2, repeat: Infinity, ease: "easeInOut", delay: idx * 0.12 }}
                >
                  <div className="rounded-xl border border-border/50 bg-card/30 px-3 py-2 text-left shadow-[0_10px_30px_-20px_hsl(var(--primary)/0.7)]">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{badge.label}</p>
                    <p className="text-sm font-semibold text-foreground">{badge.stat}</p>
                  </div>
                </motion.div>
              ))}

              {/* Floating conversion banner */}
              <motion.div
                className="absolute right-0 top-0 hidden md:flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-3 py-1 text-sm font-semibold text-primary"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: [0.2, 0.98, 0.2], y: [0, -6, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              >
                <Sparkles className="h-4 w-4" />
                This could be you
              </motion.div>

              {/* Small left-side metric accent (subtle) */}
              <motion.div
                className="hidden md:block absolute -left-10 top-44 h-8 w-8 rounded-md bg-gradient-to-tr from-success/20 to-primary/10"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.9, 0.2], y: [0, -8, 0] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
              />
            </motion.div>

            <motion.p
              className="hero-description mb-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
              initial={{ opacity: 0, y: 16, filter: shouldReduceMotion ? "none" : "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              whileHover={shouldReduceMotion ? undefined : { y: -1 }}
              transition={{ delay: 0.54, duration: 0.62 }}
            >
              Upload one long video and get creator-ready cuts with{" "}
              <span className="hero-keyword">hook detection</span>,{" "}
              <span className="hero-keyword hero-keyword-delay-1">dead-air removal</span>,{" "}
              <span className="hero-keyword hero-keyword-delay-2">captions</span>, and pacing tuned for audience retention.
            </motion.p>

            <motion.div
              className="mb-10 flex flex-wrap items-center justify-center gap-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.58, duration: 0.45 }}
            >
              {creatorPlatforms.map(({ name, Icon }, index) => (
                <motion.span
                  key={name}
                  className="hero-platform-pill group inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm"
                  whileHover={shouldReduceMotion ? undefined : { y: -4, scale: 1.04 }}
                  animate={shouldReduceMotion ? undefined : { y: [0, -3, 0] }}
                  transition={shouldReduceMotion ? undefined : { duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: index * 0.08 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                >
                  <span className="hero-platform-pill-icon-wrap flex h-5 w-5 items-center justify-center rounded-full bg-background/60 ring-1 ring-border/60 transition-colors duration-300 group-hover:bg-primary/15 group-hover:ring-primary/40">
                    <Icon className="hero-platform-pill-icon h-3.5 w-3.5 text-primary transition-colors duration-300 group-hover:text-foreground" />
                  </span>
                  {name}
                </motion.span>
              ))}
            </motion.div>

            <motion.div
              className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:gap-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.6 }}
            >
              <motion.div
                className="relative w-full sm:w-auto"
                onMouseEnter={handleTrialCtaHoverStart}
                onMouseLeave={handleTrialCtaHoverEnd}
                onFocus={handleTrialCtaHoverStart}
                onBlur={handleTrialCtaHoverEnd}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.015 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
                transition={{ type: "spring", stiffness: 320, damping: 20 }}
              >
                <AnimatePresence>
                  {isTrialCtaHovered && !shouldReduceMotion ? (
                    <>
                      <motion.span
                        key={`trial-cta-aura-${trialHoverTakeoverCycle}-$
                          {isTrialHolyGlowActive || isTrialGoldenActive ? "holy" : "trial"}`}
                        className={`pointer-events-none absolute -inset-3 -z-10 rounded-full blur-2xl ${
                          isTrialHolyGlowActive || isTrialGoldenActive ? "bg-amber-300/45" : "bg-primary/35"
                        }`}
                        initial={{ opacity: 0.2, scale: 0.85 }}
                        animate={
                          isTrialHolyGlowActive || isTrialGoldenActive
                            ? { opacity: [0.28, 0.82, 0.28], scale: [0.9, 1.3, 1.02] }
                            : { opacity: [0.18, 0.66, 0.2], scale: [0.85, 1.18, 1] }
                        }
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 1.45, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <motion.span
                        key={`trial-cta-ring-a-${trialHoverTakeoverCycle}-$
                          {isTrialHolyGlowActive || isTrialGoldenActive ? "holy" : "trial"}`}
                        className={`pointer-events-none absolute -inset-2 -z-10 rounded-full border ${
                          isTrialHolyGlowActive || isTrialGoldenActive ? "border-amber-300/75" : "border-primary/45"
                        }`}
                        initial={{ opacity: 0.82, scale: 0.8 }}
                        animate={{ opacity: [0.7, 0, 0], scale: [0.8, 1.3, 1.3] }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                      />
                      <motion.span
                        key={`trial-cta-ring-b-${trialHoverTakeoverCycle}-${isTrialHolyGlowActive ? "holy" : "trial"}`}
                        className={`pointer-events-none absolute -inset-1.5 -z-10 rounded-full border ${
                          isTrialHolyGlowActive || isTrialGoldenActive ? "border-yellow-100/65" : "border-glow-secondary/40"
                        }`}
                        initial={{ opacity: 0.72, scale: 0.84 }}
                        animate={{ opacity: [0.65, 0, 0], scale: [0.84, 1.25, 1.25] }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 1.26, repeat: Infinity, ease: "easeOut", delay: 0.12 }}
                      />
                    </>
                  ) : null}
                </AnimatePresence>
                <Link to="/pricing" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className={`hero-cta-button hero-cta-primary group w-full gap-2 rounded-full px-8 sm:w-auto ${
                      isTrialHolyGlowActive || isTrialGoldenActive
                        ? "bg-amber-300 text-amber-950 shadow-[0_0_36px_rgba(251,191,36,0.62)] hover:bg-amber-200"
                        : "bg-primary text-primary-foreground glow-sm hover:bg-primary/90"
                    }`}
                  >
                    Start Free Trial
                    <ArrowRight className="hero-cta-arrow w-4 h-4" />
                  </Button>
                </Link>
                <AnimatePresence>
                  {isTrialCtaHovered && !shouldReduceMotion ? (
                    <motion.p
                      key={`trial-cta-whisper-${trialHoverTakeoverCycle}-${
                        isTrialHolyGlowActive || isTrialGoldenActive ? "holy" : "trial"
                      }`}
                      className={`pointer-events-none absolute left-1/2 top-[calc(100%+0.55rem)] w-auto max-w-[88vw] -translate-x-1/2 rounded-md border bg-card/80 px-3 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] whitespace-normal break-words backdrop-blur-md ${
                        isTrialHolyGlowActive || isTrialGoldenActive ? "border-amber-300/65 text-amber-200" : "border-primary/35 text-primary/90"
                      }`}
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.24, ease: "easeOut" }}
                    >
                      {activeTrialInnerThoughtPrompt}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </motion.div>
              {/* Upload CTA removed per request */}
            </motion.div>
          </motion.div>

          {/* Demo Card */}
          <motion.div
            className="mt-14 w-full max-w-4xl anim-perf"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
          >
            <div className="glass-card relative p-6 sm:p-7">
              <input
                ref={demoUploadInputRef}
                type="file"
                accept=".mp4,.m4v,.mkv,video/mp4,video/m4v,video/x-m4v,video/x-matroska"
                className="hidden"
                onChange={handleDemoUploadInputChange}
              />
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-display font-semibold text-foreground">Creator Workflow</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${isDemoProcessing ? "bg-primary animate-pulse" : "bg-success"}`} />
                  <span className="text-xs text-muted-foreground">
                    {demoPhase === "ready" ? "Final export ready" : isDemoProcessing ? "Processing demo" : "Interactive upload demo"}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-2">
                  {demoSteps.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = index === activeDemoStep;
                    const isCompleted = demoPhase === "ready" ? index <= activeDemoStep : index < activeDemoStep;

                    return (
                      <motion.div
                        key={step.title}
                        initial={false}
                        animate={{
                          borderColor: isActive ? "hsl(var(--primary) / 0.55)" : "hsl(var(--border) / 0.5)",
                          backgroundColor: isActive ? "hsl(var(--primary) / 0.12)" : "hsl(var(--card) / 0.35)",
                        }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="rounded-xl border p-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background/75 text-xs font-semibold text-muted-foreground">
                            {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                              <p className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                                {step.title}
                              </p>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                  <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Interactive timeline</span>
                    <span>{activeDemoProgress}%</span>
                  </div>

                  <div
                    className={`mb-3 overflow-hidden rounded-lg border bg-background/80 transition-colors ${
                      isDemoDragging ? "border-primary/70 bg-primary/10" : "border-border/50"
                    }`}
                    onDragEnter={handleDemoDragEnter}
                    onDragOver={handleDemoDragOver}
                    onDragLeave={handleDemoDragLeave}
                    onDrop={handleDemoDrop}
                  >
                    {demoUploadUrl ? (
                      <video
                        src={demoUploadUrl}
                        controls
                        muted
                        playsInline
                        preload="metadata"
                        className="h-36 w-full object-cover"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={handleDemoUploadClick}
                        className="flex h-36 w-full flex-col items-center justify-center gap-2 px-4 text-center"
                      >
                        <span className="rounded-full bg-primary/15 p-2 text-primary">
                          <Upload className="h-4 w-4" />
                        </span>
                        <p className="text-sm font-medium text-foreground">Upload a real video to run this animated demo</p>
                        <p className="text-xs text-muted-foreground">Drop file or click to select MP4, M4V, or MKV</p>
                      </button>
                    )}
                  </div>

                    <div className="mb-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="min-w-0 truncate">
                      {demoUploadFile
                        ? `${demoUploadFile.name} (${formatUploadSize(demoUploadFile.size)})`
                        : "No source clip uploaded yet"}
                    </span>
                    <button
                      type="button"
                      onClick={handleDemoUploadClick}
                      className="shrink-0 hero-cta-button hero-cta-secondary group rounded-full border-border/60 px-3 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/55 hover:text-primary"
                    >
                      {demoUploadFile ? "Replace" : "Choose File"}
                    </button>
                  </div>

                  <div className="relative mb-3 h-20 overflow-hidden rounded-lg border border-border/50 bg-background/80 p-3">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/8 transition-all duration-700 ease-out"
                      style={{ width: `${activeDemoProgress}%` }}
                    />
                    <div className="relative grid h-full grid-cols-12 gap-1">
                      {Array.from({ length: 12 }).map((_, index) => {
                        const threshold = Math.round((activeDemoProgress / 100) * 12);
                        const isFilled = index < threshold;

                        return (
                          <div
                            key={`segment-${index}`}
                            className={`rounded-sm transition-colors duration-500 ${
                              isFilled ? "bg-primary/65" : "bg-muted/70"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <motion.div
                      className="absolute bottom-2 top-2 w-[2px] bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.85)]"
                      animate={{ left: `calc(${Math.min(activeDemoProgress, 98)}% - 1px)` }}
                      transition={{ duration: 0.7, ease: "easeInOut" }}
                    />
                  </div>

                  <Progress value={activeDemoProgress} className="h-2 bg-muted [&>div]:bg-primary" />
                  <motion.p
                    key={`${demoPhase}-${activeDemoCue}`}
                    className="mt-3 text-xs text-muted-foreground"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {activeDemoCue}
                  </motion.p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Button
                      size="sm"
                      onClick={handleDemoPrimaryAction}
                      disabled={isDemoProcessing}
                      className="w-full gap-2 rounded-full bg-primary px-4 sm:px-6 text-primary-foreground glow-sm hover:bg-primary/90 whitespace-normal break-words text-center text-sm sm:text-base leading-snug"
                    >
                      {demoPrimaryActionLabel}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={demoUploadFile ? handleDemoReset : handleDemoUploadClick}
                      className="w-full gap-2 rounded-full border-border/60 px-6"
                    >
                      {demoUploadFile ? "Reset Demo" : "Select Video"}
                    </Button>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                Upload a clip to run the fake editor + binge optimizer pipeline, then use Get Final Export to unlock signup.
              </p>

              {showDemoSignupPopup ? (
                <motion.div
                  className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-background/70 p-4 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    className="w-full max-w-sm rounded-2xl border border-primary/40 bg-card/95 p-5 shadow-[0_22px_50px_-28px_hsl(var(--primary)/0.9)]"
                    initial={{ y: 16, opacity: 0, scale: 0.96 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <p className="text-sm font-semibold text-foreground">Get Started For free</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      Your demo export is ready. Create your account to run this workflow on full projects and publish real outputs.
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      <Link to="/signup" className="w-full">
                        <Button
                          size="sm"
                          onClick={() => setShowDemoSignupPopup(false)}
                          className="w-full gap-2 rounded-full"
                        >
                          Get Started For free
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowDemoSignupPopup(false)}
                        className="w-full rounded-full text-muted-foreground"
                      >
                        Maybe Later
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </div>
          </motion.div>

          <motion.section
            className="mt-16 w-full"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="mx-auto max-w-5xl">
              <motion.div
                className="mx-auto mb-8 max-w-3xl text-center"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.45 }}
              >
                <div className="pill-badge mb-4">
                  <Sparkles className="h-3.5 w-3.5" />
                  WHY CREATORS SWITCH
                </div>
                <h2 className="text-3xl font-bold font-display text-foreground sm:text-4xl">
                  Built To Convert Viewers Into Subscribers
                </h2>
                <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                  This editor is designed for growth outcomes: stronger hooks, faster publishing, and more consistent uploads.
                </p>
              </motion.div>

              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {conversionStats.map((item, index) => (
                  <motion.div
                    key={item.label}
                    className="glass-card-hover relative overflow-hidden p-4 text-left"
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    animate={shouldReduceMotion ? undefined : { y: [0, -7, 0] }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{
                      delay: index * 0.07,
                      duration: shouldReduceMotion ? 0.4 : 3.2 + index * 0.2,
                      repeat: shouldReduceMotion ? 0 : Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <span className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary/18 blur-2xl" />
                    <span className="pointer-events-none absolute -bottom-10 -left-7 h-20 w-20 rounded-full bg-sky-300/12 blur-2xl" />
                    <span className="pointer-events-none absolute inset-px rounded-[0.95rem] border border-primary/16" />
                    <div className="relative z-10">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
                      <div className="mt-2.5 flex items-end gap-1">
                        {conversionPulseBars.map((_, barIndex) => (
                          <span
                            key={`${item.label}-${barIndex}`}
                            className="flex-1 rounded-full bg-primary/55"
                            style={{ height: `${4 + ((barIndex + index) % 4) * 1.5}px` }}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {objectionBreakers.map((item, index) => (
                  <motion.div
                    key={item.title}
                    className="glass-card relative overflow-hidden p-5 text-left"
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    animate={shouldReduceMotion ? undefined : { y: [0, -8, 0] }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{
                      delay: index * 0.08,
                      duration: shouldReduceMotion ? 0.45 : 3.4 + index * 0.25,
                      repeat: shouldReduceMotion ? 0 : Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <span className="pointer-events-none absolute inset-y-4 left-3 w-[2px] rounded-full bg-gradient-to-b from-primary/0 via-primary/70 to-sky-300/0" />
                    <span className="pointer-events-none absolute -right-10 top-8 h-24 w-24 rounded-full border border-primary/20" />
                    <span className="pointer-events-none absolute right-6 top-6 h-2 w-2 rounded-full bg-primary/70" />
                    <div className="relative z-10 pl-2">
                      <div className="mb-3 flex items-start gap-2">
                        <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        </span>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>

          {/* Card removed per request: "Ready to test on your own footage?" */}

          {/* Pricing Preview */}
          <motion.section
            className="mt-24 w-full"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <motion.div
              className="mx-auto mb-10 max-w-3xl text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5 }}
            >
              <div className="pill-badge mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                CREATOR SUBSCRIPTION PLANS
              </div>
              <h2 className="text-3xl font-bold font-display text-foreground sm:text-4xl">
                Plans for Solo Creators and Growing Channels
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                Start free, then scale render volume, export quality, and queue priority as your upload cadence grows.
              </p>
            </motion.div>

            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {proofCards.map((item, index) => (
                <motion.div
                  key={item.title}
                  className="glass-card-hover p-4"
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  animate={shouldReduceMotion ? undefined : { y: [0, -6, 0] }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ delay: index * 0.08, duration: 0.45, repeat: Infinity, ease: "easeInOut", delayChildren: index * 0.05 }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
                      <item.icon className="h-4 w-4 text-primary" />
                    </span>
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">{item.stat}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                </motion.div>
              ))}
            </div>

            <Suspense fallback={<div className="min-h-[140px]" />}>
              <PricingCards
                isAuthenticated={false}
                loading={false}
                onCheckout={() => undefined}
                onPortal={() => undefined}
                actionTier={null}
                actionKind={null}
                billingInterval="monthly"
                founderSlotsRemaining={0}
              />
            </Suspense>

            <motion.div
              className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.45 }}
            >
              <Link to="/pricing" className="w-full sm:w-auto">
                <Button variant="ghost" size="lg" className="w-full rounded-full px-8 text-muted-foreground hover:text-foreground sm:w-auto">
                  Compare Creator Plans
                </Button>
              </Link>
              <Link to="/signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full gap-2 rounded-full bg-primary px-8 text-primary-foreground hover:bg-primary/90 sm:w-auto">
                  Start Free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          </motion.section>

          <div className="mt-16 pb-2 text-center">
            <p className="text-xs text-muted-foreground">Your data matters. Read how we collect and protect it.</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
              <Link
                to="/privacy-policy"
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                Privacy Policy
              </Link>
              <span aria-hidden="true" className="opacity-70">-</span>
              <Link
                to="/how-editor-works"
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                How The Editor Works
              </Link>
            </div>
          </div>
        </div>
            </main>
          </div>
        </div>
    </GlowBackdrop>
  );
};

export default Index;
