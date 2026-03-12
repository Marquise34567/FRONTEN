import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  Loader2,
  Rocket,
  Scissors,
  SkipForward,
  Sparkles,
  Wand2,
} from "lucide-react";

import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import SeoHead from "@/components/SeoHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type DemoStep = {
  id: string;
  title: string;
  detail: string;
};

const DEMO_STEPS: DemoStep[] = [
  {
    id: "upload",
    title: "Ingest Sample Footage",
    detail: "Analyzing source resolution, speech energy, and camera movement from sample clip.",
  },
  {
    id: "hooks",
    title: "Find Hook Moments",
    detail: "Ranking opening beats for retention and scroll-stop impact in vertical feeds.",
  },
  {
    id: "cuts",
    title: "Cut + Pace For Shorts",
    detail: "Removing dead air, tightening rhythm, and shaping 9:16 loop-ready cuts.",
  },
  {
    id: "captions",
    title: "Style Captions + Voice",
    detail: "Applying vertical caption stack with active-word highlights, voice tone, and pace.",
  },
  {
    id: "variants",
    title: "Render 3x Platform Variants",
    detail: "Producing Instagram Reels, YouTube Shorts, and TikTok clip packs.",
  },
];

const DEMO_CLIPS = [
  { id: "ig-01", platform: "Instagram", title: "Fear Hook Cut", range: "00:02 - 00:18" },
  { id: "ig-02", platform: "Instagram", title: "Story Push Cut", range: "00:28 - 00:44" },
  { id: "ig-03", platform: "Instagram", title: "Payoff Loop Cut", range: "00:53 - 01:09" },
  { id: "yt-01", platform: "YouTube", title: "Shorts Intro Cut", range: "00:05 - 00:24" },
  { id: "yt-02", platform: "YouTube", title: "Value Burst Cut", range: "00:34 - 00:53" },
  { id: "yt-03", platform: "YouTube", title: "CTA Loop Cut", range: "00:59 - 01:18" },
  { id: "tt-01", platform: "TikTok", title: "Interrupt Cut", range: "00:01 - 00:14" },
  { id: "tt-02", platform: "TikTok", title: "Punchline Cut", range: "00:22 - 00:36" },
  { id: "tt-03", platform: "TikTok", title: "Replay Hook Cut", range: "00:43 - 00:57" },
];

const SHORTS_EDITOR_LINK = "/editor?autopick=1&mode=vertical";
const STEP_ADVANCE_MS = 1800;

const ShortsModeDemo = () => {
  const [stepIndex, setStepIndex] = useState(0);
  const [running, setRunning] = useState(true);
  const maxStep = DEMO_STEPS.length - 1;

  useEffect(() => {
    if (!running) return;
    if (stepIndex >= maxStep) {
      setRunning(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setStepIndex((current) => Math.min(maxStep, current + 1));
    }, STEP_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [maxStep, running, stepIndex]);

  const progressPercent = useMemo(
    () => Math.round(((stepIndex + 1) / DEMO_STEPS.length) * 100),
    [stepIndex],
  );
  const readyClipCount = useMemo(
    () => Math.min(DEMO_CLIPS.length, Math.max(1, 1 + stepIndex * 2)),
    [stepIndex],
  );

  return (
    <GlowBackdrop>
      <SeoHead
        title="Shorts Mode Demo | AutoEditor"
        description="Watch a live demo of how AutoEditor converts one source video into vertical Shorts clips with hooks, pacing, captions, and platform variants."
        path="/shorts-mode-demo"
      />
      <Navbar />
      <main className="responsive-main min-h-screen px-4 pb-20 pt-24">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mx-auto max-w-6xl space-y-6"
        >
          <div className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-card/45 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Badge className="mb-2 border-primary/45 bg-primary/15 text-primary">Shorts Mode Walkthrough</Badge>
              <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                See Exactly How Vertical Clips Are Built
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                This demo replicates the vertical editor pipeline: source ingestion, hook ranking, pacing, captions,
                and 3x platform clip renders.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setStepIndex(0);
                  setRunning(true);
                }}
              >
                <Wand2 className="h-4 w-4" />
                Replay Demo
              </Button>
              <Link to={SHORTS_EDITOR_LINK}>
                <Button className="gap-2">
                  <SkipForward className="h-4 w-4" />
                  Skip Demo
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(320px,0.9fr)_minmax(420px,1.1fr)]">
            <div className="space-y-4 rounded-2xl border border-border/50 bg-card/45 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Sample Footage</p>
                <Badge variant="outline" className="border-primary/35 bg-primary/10 text-[11px] text-primary">
                  Vertical 9:16 Preview
                </Badge>
              </div>
              <div className="overflow-hidden rounded-xl border border-border/55 bg-black/70">
                <video
                  src="/landing-demo.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls={false}
                  className="aspect-[9/16] w-full object-cover"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-border/55 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Webcam Layout</p>
                  <p className="text-xs font-semibold text-foreground">Top Strip Enabled</p>
                </div>
                <div className="rounded-lg border border-border/55 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Captions</p>
                  <p className="text-xs font-semibold text-foreground">Word Highlight Mode</p>
                </div>
                <div className="rounded-lg border border-border/55 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Voice Tone</p>
                  <p className="text-xs font-semibold text-foreground">Low Pitch</p>
                </div>
                <div className="rounded-lg border border-border/55 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Pacing</p>
                  <p className="text-xs font-semibold text-foreground">Faster</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-border/50 bg-card/45 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Pipeline Status</p>
                <span className="text-xs text-muted-foreground">{progressPercent}% complete</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.42, ease: "easeOut" }}
                  className="h-full rounded-full bg-primary"
                />
              </div>

              <div className="space-y-2">
                {DEMO_STEPS.map((step, index) => {
                  const isDone = index < stepIndex;
                  const isCurrent = index === stepIndex;
                  return (
                    <div
                      key={step.id}
                      className={`rounded-lg border px-3 py-2 transition ${
                        isCurrent
                          ? "border-primary/45 bg-primary/10"
                          : isDone
                            ? "border-emerald-400/35 bg-emerald-400/10"
                            : "border-border/50 bg-muted/15"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5">
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          ) : isCurrent && running ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                          )}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{step.title}</p>
                          <p className="text-[11px] text-muted-foreground">{step.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-border/55 bg-black/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Generated Vertical Clips</p>
                  <Badge variant="outline" className="border-border/60 text-[10px] text-muted-foreground">
                    {readyClipCount}/{DEMO_CLIPS.length} ready
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {DEMO_CLIPS.map((clip, index) => {
                    const ready = index < readyClipCount;
                    return (
                      <div
                        key={clip.id}
                        className={`rounded-lg border px-2.5 py-2 ${
                          ready ? "border-primary/35 bg-primary/10" : "border-border/55 bg-muted/10"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            {clip.platform}
                          </span>
                          {ready ? (
                            <Clapperboard className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Loader2 className="h-3.5 w-3.5 text-muted-foreground/70" />
                          )}
                        </div>
                        <p className="text-xs font-medium text-foreground">{clip.title}</p>
                        <p className="text-[10px] text-muted-foreground">{clip.range}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/45 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Move Into Real Vertical Mode</p>
                <p className="text-xs text-muted-foreground">
                  Open the full editor to upload your own footage and generate real Shorts clip packs.
                </p>
              </div>
              <Link to={SHORTS_EDITOR_LINK}>
                <Button className="gap-2">
                  <Rocket className="h-4 w-4" />
                  Open Vertical Editor
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1">
                <Scissors className="h-3.5 w-3.5" />
                AI Cut Ranking
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1">
                <Sparkles className="h-3.5 w-3.5" />
                Caption Styling
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1">
                <Clapperboard className="h-3.5 w-3.5" />
                3x Variant Exports
              </span>
            </div>
          </div>
        </motion.section>
      </main>
    </GlowBackdrop>
  );
};

export default ShortsModeDemo;
