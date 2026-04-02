import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock3,
  Download,
  Film,
  Gauge,
  Play,
  ScissorsSquare,
  Sparkles,
  Wand2,
} from "lucide-react";

type DemoModeId = "standard" | "ultra" | "retention";
type DemoStageKey =
  | "uploading"
  | "analyzing"
  | "hooking"
  | "cutting"
  | "pacing"
  | "story"
  | "subtitling"
  | "rendering"
  | "ready";

type DemoModeConfig = {
  id: DemoModeId;
  label: string;
  shortLabel: string;
  description: string;
  stageDurations: Record<Exclude<DemoStageKey, "ready">, number>;
  retentionTarget: number;
  outputRuntimeLabel: string;
  outputSummary: string;
};

type StageMeta = {
  key: DemoStageKey;
  label: string;
  summary: string;
};

const INPUT_VIDEO_URL = "/demo/landing-demo-input-2min.mp4";
const EDITED_VIDEO_URL_BY_MODE: Record<DemoModeId, string> = {
  standard: "/demo/landing-demo-edited-2min.mp4",
  ultra: "/demo/landing-demo-edited-ultra.mp4",
  retention: "/demo/landing-demo-edited-retention.mp4",
};
const INPUT_RUNTIME_LABEL = "2:00";

const DEMO_STAGES: StageMeta[] = [
  { key: "uploading", label: "Uploading", summary: "Loading source into the demo editor pipeline." },
  { key: "analyzing", label: "Analyzing", summary: "Detecting scenes, speech, and retention signals." },
  { key: "hooking", label: "Hook", summary: "Picking the strongest opening moment." },
  { key: "cutting", label: "Cuts", summary: "Removing low-energy moments and dead time." },
  { key: "pacing", label: "Pacing", summary: "Balancing momentum and pattern interrupts." },
  { key: "story", label: "Story", summary: "Ensuring continuity and sequence quality." },
  { key: "subtitling", label: "Subtitles", summary: "Applying timed caption styling." },
  { key: "rendering", label: "Rendering", summary: "Compositing final output preview." },
  { key: "ready", label: "Ready", summary: "Demo export is ready to preview." },
];

const DEMO_MODES: DemoModeConfig[] = [
  {
    id: "standard",
    label: "Standard Mode",
    shortLabel: "Standard",
    description: "Balanced speed and polish for general creator workflows.",
    stageDurations: {
      uploading: 3,
      analyzing: 7,
      hooking: 5,
      cutting: 6,
      pacing: 5,
      story: 5,
      subtitling: 4,
      rendering: 8,
    },
    retentionTarget: 78,
    outputRuntimeLabel: "1:33",
    outputSummary: "Smooth pacing + clean subtitles",
  },
  {
    id: "ultra",
    label: "Ultra Mode",
    shortLabel: "Ultra",
    description: "More aggressive optimization for punchier high-tempo cuts.",
    stageDurations: {
      uploading: 3,
      analyzing: 8,
      hooking: 6,
      cutting: 7,
      pacing: 6,
      story: 6,
      subtitling: 5,
      rendering: 10,
    },
    retentionTarget: 84,
    outputRuntimeLabel: "1:23",
    outputSummary: "Faster rhythm + tighter transitions",
  },
  {
    id: "retention",
    label: "Retention King",
    shortLabel: "Retention",
    description: "Maximum hold-time strategy focused on watch-through prediction.",
    stageDurations: {
      uploading: 3,
      analyzing: 9,
      hooking: 7,
      cutting: 7,
      pacing: 7,
      story: 6,
      subtitling: 5,
      rendering: 10,
    },
    retentionTarget: 88,
    outputRuntimeLabel: "1:19",
    outputSummary: "Retention-first sequencing",
  },
];

const STAGE_COPY: Record<DemoStageKey, string[]> = {
  uploading: [
    "Source clip capped to first 2:00 for instant trial.",
    "Chunk ingest stream is active.",
  ],
  analyzing: [
    "Scanning transcript + emotion checkpoints.",
    "Building retention map for scene ranking.",
  ],
  hooking: [
    "Scoring openers by curiosity + payoff timing.",
    "Best hook is selected for first-frame impact.",
  ],
  cutting: [
    "Low-value windows are removed automatically.",
    "Timeline is rebuilt around highest-signal moments.",
  ],
  pacing: [
    "Tempo tuning keeps momentum without losing context.",
    "Interrupt density is balanced for completion lift.",
  ],
  story: [
    "Narrative flow and coherence checks are running.",
    "Ordering pass protects clarity while trimming.",
  ],
  subtitling: [
    "Timing subtitles to the edited timeline.",
    "Caption style pass is being applied.",
  ],
  rendering: [
    "Compositing final preview output.",
    "Quality and retention projection are finalized.",
  ],
  ready: [
    "Demo edit complete. Compare before vs edited output.",
    "Open full editor to run your own footage next.",
  ],
};

const formatClock = (seconds: number) => {
  const clamped = Math.max(0, Math.round(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const formatEta = (seconds: number) => {
  const clamped = Math.max(0, Math.ceil(seconds));
  if (clamped === 0) return "Finalizing...";
  if (clamped < 60) return `${clamped}s remaining`;
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}m ${secs}s remaining`;
};

type LandingDemoEditorModalProps = {
  startSignal?: number;
};

export default function LandingDemoEditorModal({ startSignal = 0 }: LandingDemoEditorModalProps) {
  const [selectedMode, setSelectedMode] = useState<DemoModeId>("standard");
  const [isRunning, setIsRunning] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showEditedPreview, setShowEditedPreview] = useState(false);
  const runStartAtRef = useRef<number | null>(null);
  const lastHandledStartSignalRef = useRef(0);
  const inputVideoRef = useRef<HTMLVideoElement | null>(null);
  const editedVideoRef = useRef<HTMLVideoElement | null>(null);

  const selectedModeConfig = useMemo(
    () => DEMO_MODES.find((mode) => mode.id === selectedMode) ?? DEMO_MODES[0],
    [selectedMode],
  );
  const selectedEditedVideoUrl = EDITED_VIDEO_URL_BY_MODE[selectedMode];

  const stageTimeline = useMemo(() => {
    let cursor = 0;
    const steps = DEMO_STAGES.map((stage) => {
      if (stage.key === "ready") {
        return {
          ...stage,
          start: cursor,
          end: cursor,
          duration: 0,
        };
      }

      const duration = selectedModeConfig.stageDurations[stage.key];
      const start = cursor;
      cursor += duration;
      return {
        ...stage,
        start,
        end: cursor,
        duration,
      };
    });
    return {
      totalDuration: cursor,
      steps,
    };
  }, [selectedModeConfig]);

  const clampedElapsed = Math.min(stageTimeline.totalDuration, elapsedSeconds);
  const overallProgress = stageTimeline.totalDuration > 0 ? Math.round((clampedElapsed / stageTimeline.totalDuration) * 100) : 0;
  const hasStarted = isRunning || hasCompleted || elapsedSeconds > 0.05;

  const activeStepIndex = useMemo(() => {
    if (hasCompleted) return stageTimeline.steps.length - 1;
    const index = stageTimeline.steps.findIndex((step) => step.key !== "ready" && clampedElapsed < step.end);
    return index === -1 ? stageTimeline.steps.length - 1 : index;
  }, [clampedElapsed, hasCompleted, stageTimeline.steps]);

  const activeStep = stageTimeline.steps[activeStepIndex];
  const etaLabel = formatEta(Math.max(0, stageTimeline.totalDuration - clampedElapsed));
  const stageProgress =
    activeStep && activeStep.duration > 0
      ? Math.round(((clampedElapsed - activeStep.start) / activeStep.duration) * 100)
      : hasCompleted
        ? 100
        : 0;
  const retentionScore = Math.round(62 + (selectedModeConfig.retentionTarget - 62) * (overallProgress / 100));

  useEffect(() => {
    if (!isRunning) return;
    if (!runStartAtRef.current) runStartAtRef.current = Date.now();

    const tick = window.setInterval(() => {
      const startAt = runStartAtRef.current || Date.now();
      const nextElapsed = (Date.now() - startAt) / 1000;
      setElapsedSeconds(nextElapsed);
    }, 150);

    return () => window.clearInterval(tick);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    if (elapsedSeconds < stageTimeline.totalDuration) return;
    setIsRunning(false);
    setHasCompleted(true);
    setShowEditedPreview(true);
  }, [elapsedSeconds, isRunning, stageTimeline.totalDuration]);

  useEffect(() => {
    if (!showEditedPreview || !hasCompleted) return;
    const video = editedVideoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => {});
  }, [hasCompleted, showEditedPreview, selectedEditedVideoUrl]);

  const handleStart = useCallback(() => {
    runStartAtRef.current = Date.now();
    setElapsedSeconds(0);
    setHasCompleted(false);
    setShowEditedPreview(false);
    setIsRunning(true);

    const source = inputVideoRef.current;
    if (source) {
      source.currentTime = 0;
      void source.play().catch(() => {});
    }

    const output = editedVideoRef.current;
    if (output) {
      output.pause();
      output.currentTime = 0;
    }
  }, []);

  useEffect(() => {
    if (!startSignal || startSignal <= 0) return;
    if (lastHandledStartSignalRef.current === startSignal) return;
    lastHandledStartSignalRef.current = startSignal;
    const timer = window.setTimeout(() => {
      handleStart();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [handleStart, startSignal]);

  const currentStageLines = STAGE_COPY[activeStep?.key || "uploading"];

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="max-h-[92vh] overflow-y-auto">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(137,92,255,0.25),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.22),transparent_45%)]">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="border-b border-border/60 p-4 sm:p-5 lg:border-b-0 lg:border-r">
              <div className="space-y-3 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-primary/40 bg-primary/15 text-primary">
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    Live Demo Editor
                  </Badge>
                  <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                    <Clock3 className="mr-1 h-3.5 w-3.5" />
                    Demo limit: first {INPUT_RUNTIME_LABEL}
                  </Badge>
                </div>
                <h3 className="text-xl font-semibold text-foreground">See the editor process in real time</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a mode, press Start Editor, then watch this real video process from raw footage to final render.
                </p>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-black/80">
                <div className="relative aspect-video">
                  {!showEditedPreview ? (
                    <video
                      ref={inputVideoRef}
                      src={INPUT_VIDEO_URL}
                      controls
                      preload="metadata"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <video
                      key={selectedEditedVideoUrl}
                      ref={editedVideoRef}
                      src={selectedEditedVideoUrl}
                      controls
                      preload="metadata"
                      className="h-full w-full object-contain"
                    />
                  )}
                  <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-black/40 bg-black/65 px-3 py-1 text-[11px] font-medium text-white">
                    {!showEditedPreview ? "Before Edit Preview" : "Edited Output Preview"}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <p className="text-xs text-white/90">
                      {!hasStarted
                        ? "Pick a mode and press Start Editor."
                        : hasCompleted
                          ? `Finished in ${formatClock(stageTimeline.totalDuration)} • ${selectedModeConfig.outputSummary}`
                          : `${activeStep.label} • ${Math.max(0, Math.min(100, stageProgress))}% of this stage`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={!showEditedPreview ? "secondary" : "outline"}
                  onClick={() => setShowEditedPreview(false)}
                  className="rounded-full"
                >
                  <Film className="mr-1.5 h-4 w-4" />
                  Before
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={showEditedPreview ? "secondary" : "outline"}
                  onClick={() => setShowEditedPreview(true)}
                  className="rounded-full"
                  disabled={!hasCompleted}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Edited
                </Button>
                <p className="self-center text-xs text-muted-foreground">
                  Source runtime: {INPUT_RUNTIME_LABEL} • Edited runtime: {selectedModeConfig.outputRuntimeLabel}
                </p>
              </div>
            </section>

            <section className="p-4 sm:p-5">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/65 bg-card/80 p-3.5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Editing Mode</p>
                  <div className="grid gap-2">
                    {DEMO_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        disabled={isRunning}
                        onClick={() => {
                          setSelectedMode(mode.id);
                          setIsRunning(false);
                          setHasCompleted(false);
                          setShowEditedPreview(false);
                          setElapsedSeconds(0);
                          runStartAtRef.current = null;
                        }}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-left transition",
                          selectedMode === mode.id
                            ? "border-primary/55 bg-primary/10"
                            : "border-border/70 hover:border-primary/35 hover:bg-muted/35",
                          isRunning ? "cursor-not-allowed opacity-70" : "",
                        )}
                      >
                        <p className="text-sm font-medium text-foreground">{mode.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{mode.description}</p>
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="flex-1 rounded-full"
                      onClick={handleStart}
                      disabled={isRunning}
                    >
                      {isRunning ? (
                        <>
                          <Gauge className="mr-1.5 h-4 w-4 animate-pulse" />
                          Editing...
                        </>
                      ) : (
                        <>
                          <Play className="mr-1.5 h-4 w-4" />
                          Start Editor
                        </>
                      )}
                    </Button>
                    {hasCompleted && (
                      <Button type="button" variant="outline" className="rounded-full" onClick={handleStart}>
                        Replay
                      </Button>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/65 bg-card/80 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{activeStep.label}</p>
                    <Badge variant="outline" className="border-border/70 bg-muted/30 text-[11px] text-muted-foreground">
                      {hasCompleted ? "Completed" : etaLabel}
                    </Badge>
                  </div>
                  <Progress value={hasCompleted ? 100 : overallProgress} className="mt-2 h-2 bg-muted [&>div]:bg-primary" />
                  <p className="mt-2 text-xs text-muted-foreground">{activeStep.summary}</p>
                  <div className="mt-2 space-y-1">
                    {currentStageLines.map((line) => (
                      <p key={line} className="text-[11px] text-muted-foreground">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/65 bg-card/80 p-3.5">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <Wand2 className="h-3.5 w-3.5" />
                    Pipeline Status
                  </div>
                  <div className="space-y-1.5">
                    {stageTimeline.steps.map((step, index) => {
                      const isLive = hasStarted && !hasCompleted && index === activeStepIndex;
                      const isDone = hasCompleted || (hasStarted && step.key !== "ready" && clampedElapsed >= step.end);
                      return (
                        <div
                          key={step.key}
                          className={cn(
                            "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs",
                            isLive
                              ? "border-primary/45 bg-primary/10 text-primary"
                              : isDone
                                ? "border-success/40 bg-success/10 text-success"
                                : "border-border/65 bg-muted/25 text-muted-foreground",
                          )}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ScissorsSquare className="h-3.5 w-3.5" />}
                            {step.label}
                          </span>
                          <span>{isLive ? "Live" : isDone ? "Done" : "Pending"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Retention</p>
                    <p className="text-sm font-semibold text-foreground">{retentionScore}/100</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Mode</p>
                    <p className="text-sm font-semibold text-foreground">{selectedModeConfig.shortLabel}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Output</p>
                    <p className="text-sm font-semibold text-foreground">{selectedModeConfig.outputRuntimeLabel}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
