import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, ArrowLeft, BarChart3, BrainCircuit, Gauge, ScanFace, Sparkles, Target, Wand2 } from "lucide-react";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

const timelineSeries = [
  { stamp: "0:00", energy: 84, emotion: 69, retention: 91 },
  { stamp: "0:18", energy: 78, emotion: 74, retention: 86 },
  { stamp: "0:36", energy: 88, emotion: 76, retention: 90 },
  { stamp: "0:54", energy: 93, emotion: 81, retention: 92 },
  { stamp: "1:12", energy: 86, emotion: 84, retention: 88 },
  { stamp: "1:30", energy: 82, emotion: 79, retention: 84 },
  { stamp: "1:48", energy: 89, emotion: 86, retention: 87 },
  { stamp: "2:06", energy: 91, emotion: 83, retention: 89 },
] as const;

const facialZones = [
  { label: "Face Zone 1", at: "0:24", intensity: 93, detail: "Eye contact lock + high motion sync" },
  { label: "Face Zone 2", at: "0:38", intensity: 81, detail: "Expression confidence spike" },
  { label: "Face Zone 3", at: "1:03", intensity: 87, detail: "Facial clarity + vocal emphasis" },
  { label: "Face Zone 4", at: "1:28", intensity: 76, detail: "Re-hook expression reset" },
] as const;

const platformForecast = [
  { label: "YouTube Long-Form", before: 71, after: 83, lift: "+12" },
  { label: "TikTok", before: 65, after: 88, lift: "+23" },
  { label: "IG Reels", before: 67, after: 86, lift: "+19" },
] as const;

const storyMapRows = [
  { phase: "Hook", range: "0:00-0:18", score: 91, note: "Pattern interrupt locked." },
  { phase: "Build-up", range: "0:18-1:03", score: 84, note: "Curiosity tension stabilized." },
  { phase: "Payoff", range: "1:03-1:48", score: 89, note: "Reward delivered with high clarity." },
  { phase: "Cliffhanger", range: "1:48-2:06", score: 86, note: "Loop handoff secured for replay." },
] as const;

const autonomousNotes = [
  "Payoff pressure improved after moving reveal 8.2s earlier in the opener.",
  "Boundary critic flagged two rough joins; both were softened by continuity-first pacing.",
  "Hook candidate #3 won the global faceoff with stronger curiosity carryover.",
  "Emotion-anchored re-hooks are now inserted every 42s based on drop-off trend.",
  "Adaptive style lock is running at 78% from 24 feedback samples.",
] as const;

const toPoints = (rows: readonly { energy: number; emotion: number }[], key: "energy" | "emotion") => (
  rows
    .map((row, index) => {
      const x = rows.length <= 1 ? 0 : (index / (rows.length - 1)) * 100;
      const y = 100 - row[key];
      return `${x},${y}`;
    })
    .join(" ")
);
const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
const readPercentParam = (params: URLSearchParams, key: string, fallback: number) => {
  const raw = Number(params.get(key));
  if (!Number.isFinite(raw)) return clampPercent(fallback);
  return clampPercent(raw);
};
const readCountParam = (params: URLSearchParams, key: string, fallback: number) => {
  const raw = Number(params.get(key));
  if (!Number.isFinite(raw)) return Math.max(0, Math.round(fallback));
  return Math.max(0, Math.round(raw));
};
const readNumberFrom = (source: Record<string, any> | null | undefined, keys: string[]) => {
  if (!source) return null;
  for (const key of keys) {
    const raw = Number(source[key]);
    if (Number.isFinite(raw)) return raw;
  }
  return null;
};
const readStringFrom = (source: Record<string, any> | null | undefined, keys: string[]) => {
  if (!source) return "";
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return "";
};
const normalizeTextList = (values: unknown[]) => {
  const list = values
    .map((value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""))
    .filter((value) => value.length > 0);
  return Array.from(new Set(list)).slice(0, 8);
};
const extractTextList = (source: Record<string, any> | null | undefined, keys: string[]) => {
  if (!source) return [] as string[];
  const collected: unknown[] = [];
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) collected.push(...value);
    else if (typeof value === "string") collected.push(value);
  }
  return normalizeTextList(collected);
};
const formatOptionalDateTime = (value: unknown) => {
  if (!value) return "";
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
const clampScore = (value: number | null) => {
  if (value === null) return null;
  if (!Number.isFinite(value)) return null;
  const scaled = Math.abs(value) <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(scaled)));
};
const parseBooleanLike = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes"].includes(normalized)) return true;
    if (["0", "false", "no"].includes(normalized)) return false;
  }
  return null;
};

const EditorAMode = () => {
  const [searchParams] = useSearchParams();
  const { accessToken } = useAuth();
  const [jobDetail, setJobDetail] = useState<Record<string, any> | null>(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [jobError, setJobError] = useState("");
  const avgRetention = useMemo(() => (
    Math.round(timelineSeries.reduce((sum, row) => sum + row.retention, 0) / timelineSeries.length)
  ), []);
  const avgEmotion = useMemo(() => (
    Math.round(timelineSeries.reduce((sum, row) => sum + row.emotion, 0) / timelineSeries.length)
  ), []);
  const peakEnergyPoint = useMemo(() => (
    timelineSeries.reduce((best, current) => (current.energy > best.energy ? current : best), timelineSeries[0])
  ), []);
  const fullVideoScanProgress = useMemo(() => {
    const raw = Number(searchParams.get("fullScanProgress"));
    if (Number.isFinite(raw)) return Math.max(0, Math.min(100, raw));
    return 100;
  }, [searchParams]);
  const fullVideoScanLabel = useMemo(() => {
    const raw = String(searchParams.get("fullScanLabel") || "").trim();
    if (raw) return raw.slice(0, 120);
    if (fullVideoScanProgress >= 100) return "Full scan complete";
    return `Full scan ${Math.round(fullVideoScanProgress)}% complete`;
  }, [searchParams, fullVideoScanProgress]);
  const activeJobId = useMemo(() => String(searchParams.get("jobId") || "").trim(), [searchParams]);
  useEffect(() => {
    let cancelled = false;
    if (!accessToken || !activeJobId) {
      setJobDetail(null);
      setJobLoading(false);
      setJobError("");
      return;
    }
    setJobLoading(true);
    setJobError("");
    apiFetch<{ job?: Record<string, any> }>(`/api/jobs/${activeJobId}`, { token: accessToken })
      .then((data) => {
        if (cancelled) return;
        setJobDetail(data.job ?? null);
      })
      .catch((error: any) => {
        if (cancelled) return;
        setJobDetail(null);
        setJobError(error?.message || "Unable to load job details.");
      })
      .finally(() => {
        if (cancelled) return;
        setJobLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeJobId]);
  const backToEditorHref = useMemo(() => {
    if (!activeJobId) return "/editor";
    return `/editor?jobId=${encodeURIComponent(activeJobId)}`;
  }, [activeJobId]);
  const rateDecisionReady = useMemo(() => {
    const raw = String(searchParams.get("rateDecisionReady") || "").trim().toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes";
  }, [searchParams]);
  const rateOverallScore = useMemo(() => {
    const raw = Number(searchParams.get("rateOverall"));
    if (!Number.isFinite(raw)) return null;
    return clampPercent(Math.round(raw));
  }, [searchParams]);
  const rateAverageScore = useMemo(() => readPercentParam(searchParams, "rateAverage", 79), [searchParams]);
  const rateByPlatform = useMemo(() => ({
    youtube: readPercentParam(searchParams, "rateYoutube", 80),
    tiktok: readPercentParam(searchParams, "rateTiktok", 84),
    instagramReels: readPercentParam(searchParams, "rateInstagram", 82),
  }), [searchParams]);
  const rateTopLabel = useMemo(() => {
    const explicit = String(searchParams.get("rateTopLabel") || "").trim();
    if (explicit) return explicit.slice(0, 48);
    const rows = [
      { label: "YouTube", score: rateByPlatform.youtube },
      { label: "TikTok", score: rateByPlatform.tiktok },
      { label: "IG Reels", score: rateByPlatform.instagramReels },
    ];
    return rows.reduce((best, row) => (row.score > best.score ? row : best), rows[0]).label;
  }, [rateByPlatform.instagramReels, rateByPlatform.tiktok, rateByPlatform.youtube, searchParams]);
  const rateTopScore = useMemo(() => {
    const raw = Number(searchParams.get("rateTopScore"));
    if (Number.isFinite(raw)) return clampPercent(Math.round(raw));
    return Math.max(rateByPlatform.youtube, rateByPlatform.tiktok, rateByPlatform.instagramReels);
  }, [rateByPlatform.instagramReels, rateByPlatform.tiktok, rateByPlatform.youtube, searchParams]);
  const rateSelectedCount = useMemo(() => readCountParam(searchParams, "rateSelected", 0), [searchParams]);
  const rateSuggestionCount = useMemo(
    () => Math.max(rateSelectedCount, readCountParam(searchParams, "rateSuggestions", 0)),
    [rateSelectedCount, searchParams],
  );
  const rateUpdatedLabel = useMemo(() => {
    const raw = String(searchParams.get("rateUpdated") || "").trim();
    if (!raw) return "Awaiting first live update";
    return raw.slice(0, 40);
  }, [searchParams]);
  const rateScoreRows = useMemo(() => ([
    {
      key: "youtube",
      label: "YouTube",
      score: rateByPlatform.youtube,
      barClassName: "from-rose-300/85 to-red-400/85",
    },
    {
      key: "tiktok",
      label: "TikTok",
      score: rateByPlatform.tiktok,
      barClassName: "from-cyan-300/85 to-blue-400/85",
    },
    {
      key: "instagram",
      label: "IG Reels",
      score: rateByPlatform.instagramReels,
      barClassName: "from-fuchsia-300/85 to-pink-400/85",
    },
  ]), [rateByPlatform.instagramReels, rateByPlatform.tiktok, rateByPlatform.youtube]);
  const energyPoints = useMemo(() => toPoints(timelineSeries, "energy"), []);
  const emotionPoints = useMemo(() => toPoints(timelineSeries, "emotion"), []);
  const jobAnalysis = useMemo(() => {
    const raw = jobDetail?.analysis;
    if (!raw || typeof raw !== "object") return null;
    return raw as Record<string, any>;
  }, [jobDetail]);
  const jobAutonomous = useMemo(() => {
    if (jobDetail?.autonomousEditor && typeof jobDetail.autonomousEditor === "object") {
      return jobDetail.autonomousEditor as Record<string, any>;
    }
    const nested = jobAnalysis?.autonomous_editor ?? jobAnalysis?.autonomousEditor;
    if (!nested || typeof nested !== "object") return null;
    return nested as Record<string, any>;
  }, [jobAnalysis, jobDetail]);
  const retentionScoreAfter = useMemo(
    () => clampScore(
      readNumberFrom(jobAnalysis, [
        "retention_score_after",
        "retentionScoreAfter",
        "retentionScore",
        "retention_score",
      ]) ?? (jobDetail?.retentionScore ?? null),
    ),
    [jobAnalysis, jobDetail?.retentionScore],
  );
  const retentionScoreBefore = useMemo(
    () => clampScore(readNumberFrom(jobAnalysis, ["retention_score_before", "retentionScoreBefore"])),
    [jobAnalysis],
  );
  const retentionScoreDelta = useMemo(() => {
    const raw = readNumberFrom(jobAnalysis, ["retention_score_delta", "retentionScoreDelta", "retentionDelta"]);
    if (raw !== null && Number.isFinite(raw)) {
      const scaled = Math.abs(raw) <= 1 ? raw * 100 : raw;
      return Number(scaled.toFixed(1));
    }
    if (retentionScoreAfter !== null && retentionScoreBefore !== null) {
      return Number((retentionScoreAfter - retentionScoreBefore).toFixed(1));
    }
    return null;
  }, [jobAnalysis, retentionScoreAfter, retentionScoreBefore]);
  const hookConfidence = useMemo(
    () => clampScore(readNumberFrom(jobAnalysis, ["hook_audit_score", "hookAuditScore", "hook_score", "hookScore"])),
    [jobAnalysis],
  );
  const retentionTargetPlatformLabel = useMemo(() => {
    const raw = readStringFrom(jobAnalysis, [
      "retentionTargetPlatform",
      "retention_target_platform",
      "retentionPlatform",
      "targetPlatform",
      "platform",
    ])
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (!raw) return "Auto";
    if (raw.includes("tiktok")) return "TikTok";
    if (raw.includes("instagram")) return "IG Reels";
    if (raw.includes("reels")) return "IG Reels";
    if (raw.includes("youtube")) return "YouTube";
    return raw.replace(/_/g, " ");
  }, [jobAnalysis]);
  const qualityGate = useMemo(() => {
    const raw = jobAutonomous?.qualityGate ?? jobAnalysis?.qualityGate ?? jobAnalysis?.quality_gate;
    if (!raw || typeof raw !== "object") return null;
    return raw as Record<string, any>;
  }, [jobAnalysis, jobAutonomous]);
  const qualityGatePassed = parseBooleanLike(qualityGate?.passed);
  const qualityGateScore = useMemo(() => {
    const passedChecks = Number(qualityGate?.passedChecks ?? qualityGate?.passed_checks);
    const totalChecks = Number(qualityGate?.totalChecks ?? qualityGate?.total_checks);
    if (Number.isFinite(passedChecks) && Number.isFinite(totalChecks) && totalChecks > 0) {
      return `${Math.round(passedChecks)}/${Math.round(totalChecks)}`;
    }
    return null;
  }, [qualityGate?.passedChecks, qualityGate?.passed_checks, qualityGate?.totalChecks, qualityGate?.total_checks]);
  const humanReviewRequired = useMemo(() => {
    return parseBooleanLike(
      jobAnalysis?.humanReviewRequired ??
      jobAnalysis?.human_review_required,
    );
  }, [jobAnalysis]);
  const humanReviewState = useMemo(() => {
    const review = jobAnalysis?.human_review ?? jobAnalysis?.humanReview;
    if (!review || typeof review !== "object") return null;
    return review as Record<string, any>;
  }, [jobAnalysis]);
  const humanReviewNotes = useMemo(() => extractTextList(humanReviewState, [
    "comments",
    "reviewComments",
    "review_comments",
    "notes",
    "todo",
    "todo_list",
    "actionItems",
    "action_items",
    "instructions",
    "reviewerNotes",
    "reviewer_notes",
  ]), [humanReviewState]);
  const editorInstructionPlan = useMemo(() => {
    const plan = jobAnalysis?.editorInstructionPlan ?? jobAnalysis?.editor_instruction_plan;
    if (!plan || typeof plan !== "object") return null;
    return plan as Record<string, any>;
  }, [jobAnalysis]);
  const editorInstructionPrompt = useMemo(() => readStringFrom(jobAnalysis, [
    "editorInstructionPrompt",
    "editor_instruction_prompt",
    "directorNotes",
    "director_notes",
  ]), [jobAnalysis]);
  const agentTaskNotes = useMemo(() => {
    const fromPlan = Array.isArray(editorInstructionPlan?.notes) ? editorInstructionPlan?.notes : [];
    const fromReview = extractTextList(humanReviewState, [
      "agentNotes",
      "agent_notes",
      "agentTasks",
      "agent_tasks",
      "aiTasks",
      "ai_tasks",
    ]);
    return normalizeTextList([...(fromPlan || []), ...fromReview]);
  }, [editorInstructionPlan?.notes, humanReviewState]);
  const decisionNotes = useMemo(() => {
    if (Array.isArray(jobAutonomous?.notes) && jobAutonomous?.notes.length > 0) {
      return normalizeTextList(jobAutonomous.notes);
    }
    if (Array.isArray(jobAutonomous?.learning?.notes) && jobAutonomous?.learning?.notes.length > 0) {
      return normalizeTextList(jobAutonomous.learning.notes);
    }
    return autonomousNotes;
  }, [jobAutonomous]);

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main min-h-screen px-4 pb-20 pt-24">
        <motion.header
          className="mx-auto max-w-6xl space-y-3"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Link
            to={backToEditorHref}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to editor
          </Link>
          <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-[linear-gradient(140deg,rgba(30,32,74,0.78),rgba(13,19,42,0.7))] p-5 backdrop-blur">
            <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 left-12 h-28 w-28 rounded-full bg-cyan-300/15 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge className="border-primary/35 bg-primary/10 text-foreground">A-Mode</Badge>
                <Badge className="border-border/55 bg-background/55 text-foreground">Self-directed · Learning live</Badge>
              </div>
              <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">A-Mode Intelligence Deck</h1>
              <p className="mt-2 max-w-3xl text-sm text-foreground/85">
                Expanded retention intelligence with richer data, modern graphing, and a premium decision dashboard.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {jobLoading ? (
                  <Badge className="border-cyan-300/35 bg-cyan-400/10 text-cyan-100">Syncing job data...</Badge>
                ) : null}
                {jobError ? (
                  <Badge className="border-rose-400/35 bg-rose-500/10 text-rose-200">{jobError}</Badge>
                ) : null}
                {jobDetail?.id ? (
                  <Badge className="border-border/60 bg-background/60 text-foreground">Job {jobDetail.id.slice(0, 10)}</Badge>
                ) : null}
                {jobDetail?.status ? (
                  <Badge className="border-border/60 bg-background/60 text-foreground">{String(jobDetail.status).toUpperCase()}</Badge>
                ) : null}
                {jobDetail?.renderMode ? (
                  <Badge className="border-border/60 bg-background/60 text-foreground">
                    {jobDetail.renderMode === "vertical" ? "Vertical render" : "Horizontal render"}
                  </Badge>
                ) : null}
                {jobDetail?.createdAt ? (
                  <span>Started {formatOptionalDateTime(jobDetail.createdAt)}</span>
                ) : null}
              </div>
            </div>
          </div>
        </motion.header>

        <motion.section
          className="mx-auto mt-6 grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
        >
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Avg retention</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{retentionScoreAfter ?? avgRetention}%</p>
            <p className="text-[11px] text-muted-foreground">
              {retentionScoreAfter !== null ? "Latest retention score" : "Target 70%+ sustained"}
            </p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Peak energy</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{peakEnergyPoint.energy}</p>
            <p className="text-[11px] text-muted-foreground">At {peakEnergyPoint.stamp}</p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Emotion sync</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{avgEmotion}</p>
            <p className="text-[11px] text-muted-foreground">Facial + audio weighted</p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Quality gate</p>
            <p className={`mt-1 text-2xl font-semibold ${qualityGatePassed === false ? "text-rose-200" : "text-emerald-200"}`}>
              {qualityGateScore ?? "7/7"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {qualityGatePassed === false
                ? "Gate needs attention"
                : qualityGateScore
                  ? "All hard checks passed"
                  : "Quality gate awaiting signal"}
            </p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Rate Card Winner</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{rateTopScore}</p>
            <p className="text-[11px] text-muted-foreground">{rateTopLabel}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {rateDecisionReady ? "Locked on ready render" : "Live estimate"}
            </p>
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-4 grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.35 }}
        >
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Retention before</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{retentionScoreBefore ?? "--"}</p>
            <p className="text-[11px] text-muted-foreground">Baseline signal</p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Retention delta</p>
            <p className={`mt-1 text-2xl font-semibold ${
              retentionScoreDelta === null
                ? "text-foreground"
                : retentionScoreDelta >= 0
                  ? "text-emerald-200"
                  : "text-rose-200"
            }`}>
              {retentionScoreDelta !== null ? `${retentionScoreDelta > 0 ? "+" : ""}${retentionScoreDelta}` : "--"}
            </p>
            <p className="text-[11px] text-muted-foreground">After - before</p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Hook confidence</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{hookConfidence ?? "--"}{hookConfidence !== null ? "%" : ""}</p>
            <p className="text-[11px] text-muted-foreground">Opener signal</p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Target platform</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{retentionTargetPlatformLabel}</p>
            <p className="text-[11px] text-muted-foreground">Retention focus</p>
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-4 grid max-w-6xl gap-4 lg:grid-cols-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.38 }}
        >
          <article className="relative overflow-hidden rounded-2xl border border-primary/25 bg-[linear-gradient(145deg,rgba(29,35,68,0.72),rgba(14,18,39,0.74))] p-4">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5 text-primary" />
                  Editor Agent Rate Card
                </p>
                <Badge className="border-primary/35 bg-primary/10 text-foreground">Moved to A-Mode</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <p className="font-display text-5xl font-bold leading-none text-foreground">
                  {rateOverallScore ?? "--"}
                </p>
                <span className="pb-1 text-sm text-muted-foreground">{rateDecisionReady ? "/100" : "pending"}</span>
              </div>
              <p className="mt-1 text-xs text-foreground/90">
                Top platform: {rateTopLabel} {rateDecisionReady ? `${rateTopScore}/100` : "(estimating)"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Avg score {rateAverageScore}/100 · Updated {rateUpdatedLabel}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Suggestions selected {rateSelectedCount}/{rateSuggestionCount}
              </p>
              <div className="mt-3 space-y-2">
                {rateScoreRows.map((row) => (
                  <div key={row.key} className="rounded-lg border border-border/55 bg-background/45 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{row.label}</p>
                      <Badge className="border-primary/35 bg-primary/10 text-foreground">{row.score}</Badge>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted/65">
                      <div className={`h-full rounded-full bg-gradient-to-r ${row.barClassName}`} style={{ width: `${row.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Full Video Scan Progress
              </p>
              <Badge className="border-cyan-300/35 bg-cyan-400/10 text-cyan-100">
                {fullVideoScanProgress >= 100 ? "Scan complete" : "Scan running"}
              </Badge>
            </div>
            <p className="mt-3 font-display text-5xl font-bold leading-none text-foreground">{Math.round(fullVideoScanProgress)}%</p>
            <Progress
              value={fullVideoScanProgress}
              className="mt-3 h-2.5 bg-muted/70 [&>div]:bg-gradient-to-r [&>div]:from-cyan-300 [&>div]:to-primary"
            />
            <p className="mt-2 text-sm text-foreground/90">{fullVideoScanLabel}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Render Link</p>
                <p className="mt-1 text-xs text-foreground">{activeJobId ? `Job ${activeJobId.slice(0, 12)}` : "No job selected"}</p>
              </div>
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Mode Note</p>
                <p className="mt-1 text-xs text-foreground">Full scan and rate decisions now live on this page.</p>
              </div>
            </div>
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-4 grid max-w-6xl gap-4 lg:grid-cols-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.38 }}
        >
          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Modern Energy + Emotion Timeline
              </p>
              <Badge className="border-primary/35 bg-primary/10 text-foreground">Premium graph</Badge>
            </div>
            <div className="mt-3 h-44 rounded-xl border border-border/55 bg-[linear-gradient(180deg,rgba(26,33,59,0.76),rgba(14,19,38,0.62))] p-3">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                <defs>
                  <linearGradient id="a-mode-energy" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(56,189,248,0.95)" />
                    <stop offset="100%" stopColor="rgba(16,185,129,0.95)" />
                  </linearGradient>
                  <linearGradient id="a-mode-emotion" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(244,114,182,0.95)" />
                    <stop offset="100%" stopColor="rgba(251,146,60,0.95)" />
                  </linearGradient>
                </defs>
                <polyline points={energyPoints} fill="none" stroke="url(#a-mode-energy)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={emotionPoints} fill="none" stroke="url(#a-mode-emotion)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {timelineSeries.map((row) => (
                <div key={row.stamp} className="rounded-md border border-border/50 bg-background/45 px-2 py-1.5">
                  <p className="text-[10px] text-muted-foreground">{row.stamp}</p>
                  <p className="text-[11px] font-medium text-foreground">E {row.energy} · M {row.emotion}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                Platform Outcome Forecast
              </p>
              <Badge className="border-emerald-400/35 bg-emerald-500/10 text-emerald-200">Live uplift deck</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {platformForecast.map((row) => (
                <div key={row.label} className="rounded-lg border border-border/55 bg-background/45 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{row.label}</p>
                    <Badge className="border-primary/35 bg-primary/10 text-primary">Lift {row.lift}</Badge>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Before</span>
                        <span>{row.before}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/70">
                        <div className="h-full rounded-full bg-slate-400/75" style={{ width: `${row.before}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>After</span>
                        <span>{row.after}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/70">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-300/80" style={{ width: `${row.after}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <ScanFace className="h-3.5 w-3.5 text-primary" />
                Facial Signal Heatmap
              </p>
              <Badge className="border-primary/35 bg-primary/10 text-foreground">+15% est. lift</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {facialZones.map((zone) => (
                <div key={zone.label} className="rounded-lg border border-border/60 bg-background/60 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{zone.label} · {zone.at}</p>
                    <Badge className="border-border/55 bg-background/55 text-foreground">{zone.intensity}</Badge>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted/70">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-300/90 to-primary/90" style={{ width: `${zone.intensity}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{zone.detail}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Editor Agent Story Map
              </p>
              <Badge className="border-amber-400/35 bg-amber-500/10 text-amber-200">Narrative tuned</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {storyMapRows.map((row) => (
                <div key={row.phase} className="rounded-lg border border-border/60 bg-background/50 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{row.phase}</p>
                    <Badge variant="outline" className="border-border/55 bg-background/45 text-[10px] text-muted-foreground">
                      {row.range}
                    </Badge>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted/70">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary/90 to-emerald-300/85" style={{ width: `${row.score}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{row.note}</p>
                </div>
              ))}
            </div>
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-4 grid max-w-6xl gap-4 lg:grid-cols-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.38 }}
        >
          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Human Review Details
              </p>
              <Badge className={humanReviewRequired ? "border-amber-300/40 bg-amber-500/12 text-amber-100" : "border-emerald-400/35 bg-emerald-500/12 text-emerald-200"}>
                {humanReviewRequired ? "Review enabled" : "Auto-approve"}
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Status</p>
                <p className="mt-1 text-xs text-foreground">
                  {humanReviewState?.status
                    ? String(humanReviewState.status).replace(/_/g, " ")
                    : humanReviewRequired
                      ? "Awaiting review"
                      : "Not required"}
                </p>
              </div>
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Preview</p>
                <p className="mt-1 text-xs text-foreground">
                  {humanReviewState?.previewDurationSeconds
                    ? `${Math.round(Number(humanReviewState.previewDurationSeconds))}s`
                    : "Pending"}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {humanReviewState?.previewMode ? `Mode ${humanReviewState.previewMode}` : "Preview not ready"}
                </p>
              </div>
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Requested</p>
                <p className="mt-1 text-xs text-foreground">{formatOptionalDateTime(humanReviewState?.requestedAt) || "--"}</p>
              </div>
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Approved</p>
                <p className="mt-1 text-xs text-foreground">{formatOptionalDateTime(humanReviewState?.approvedAt) || "--"}</p>
              </div>
            </div>
            {humanReviewState?.previewError ? (
              <p className="mt-2 text-[11px] text-rose-200">Preview error: {String(humanReviewState.previewError)}</p>
            ) : null}
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Reviewer notes</p>
              {humanReviewNotes.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {humanReviewNotes.map((note) => (
                    <div key={note} className="rounded-lg border border-border/55 bg-background/45 px-3 py-2 text-xs text-foreground/90">
                      {note}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No human review notes yet.</p>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Agent Task Brief
              </p>
              <Badge className="border-primary/35 bg-primary/10 text-foreground">AI agent notes</Badge>
            </div>
            {editorInstructionPrompt ? (
              <div className="mt-3 rounded-lg border border-border/55 bg-background/45 px-3 py-2 text-xs text-foreground/90">
                {editorInstructionPrompt}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No agent prompt attached yet.</p>
            )}
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Action items</p>
              {agentTaskNotes.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {agentTaskNotes.map((note) => (
                    <div key={note} className="rounded-lg border border-border/55 bg-background/45 px-3 py-2 text-xs text-foreground/90">
                      {note}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No agent action items found.</p>
              )}
            </div>
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-4 max-w-6xl rounded-2xl border border-primary/25 bg-background/55 p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <BrainCircuit className="h-3.5 w-3.5 text-primary" />
              Autonomous Editor Decision Log
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Badge className="border-primary/35 bg-primary/10 text-foreground">
                <Gauge className="mr-1 h-3.5 w-3.5" />
                Cut quality 56%
              </Badge>
              <Badge className="border-emerald-400/35 bg-emerald-500/10 text-emerald-200">
                <Target className="mr-1 h-3.5 w-3.5" />
                Goal line active
              </Badge>
              <Badge className="border-sky-400/35 bg-sky-500/10 text-sky-100">
                <Wand2 className="mr-1 h-3.5 w-3.5" />
                Refined Mar 10
              </Badge>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {decisionNotes.map((note) => (
              <div key={note} className="rounded-lg border border-border/55 bg-background/45 px-3 py-2 text-xs text-foreground/90">
                {note}
              </div>
            ))}
          </div>
        </motion.section>

        <div className="mx-auto mt-6 flex max-w-6xl justify-end">
          <Button asChild>
            <Link to={backToEditorHref}>Return to Editor</Link>
          </Button>
        </div>
      </main>
    </GlowBackdrop>
  );
};

export default EditorAMode;
