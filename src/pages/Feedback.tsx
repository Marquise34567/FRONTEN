import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/providers/AuthProvider";
import { useMe } from "@/hooks/use-me";
import { ApiError, apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, TrendingUp, Upload, WandSparkles } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type FeedbackJob = {
  id: string;
  title: string;
  createdAt: string;
  durationSeconds: number | null;
};

type TrendInsight = {
  title: string;
  summary: string;
  howToApply: string;
  source: string;
  url: string;
  publishedAt: string | null;
};

type FeedbackAnalysis = {
  detectedNiche: string;
  detectedTopics: string[];
  trendingTopics: string[];
  voicePerformance: string[];
  positioningAngle: string[];
  contentTips: string[];
  retentionBoosts: string[];
  trendInsights: TrendInsight[];
  retentionBoostEstimatePercent: number;
  visuals: {
    retentionCurve: Array<{ second: number; score: number }>;
    suggestionPins: Array<{ second: number; label: string }>;
  };
};

type FeedbackResponse = {
  generatedAt: string;
  feedback: FeedbackAnalysis;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const asFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asStringArray = (value: unknown) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);

const normalizeTrendInsight = (value: unknown): TrendInsight | null => {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  const title = String(entry.title ?? "").trim();
  const summary = String(entry.summary ?? "").trim();
  const howToApply = String(entry.howToApply ?? entry.how_to_apply ?? "").trim();
  if (!title && !summary && !howToApply) return null;
  return {
    title: title || "Trend signal",
    summary: summary || "Fresh trend signal detected in creator ecosystem coverage.",
    howToApply: howToApply || "Apply this signal in your opener with a clearer payoff hook.",
    source: String(entry.source ?? "").trim() || "AutoEditor",
    url: String(entry.url ?? "").trim(),
    publishedAt: entry.publishedAt ? String(entry.publishedAt) : entry.published_at ? String(entry.published_at) : null,
  };
};

const normalizeRetentionCurve = (value: unknown): Array<{ second: number; score: number }> => {
  const points = (Array.isArray(value) ? value : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const point = entry as Record<string, unknown>;
      const second = Math.max(0, Math.round(asFiniteNumber(point.second ?? point.time, Number.NaN)));
      const score = clamp(asFiniteNumber(point.score ?? point.retention ?? point.value, Number.NaN), 0, 100);
      if (!Number.isFinite(second) || !Number.isFinite(score)) return null;
      return { second, score: Math.round(score) };
    })
    .filter((entry): entry is { second: number; score: number } => Boolean(entry));

  if (points.length) return points;
  return [
    { second: 0, score: 92 },
    { second: 15, score: 84 },
    { second: 30, score: 76 },
    { second: 45, score: 69 },
    { second: 60, score: 63 },
  ];
};

const normalizeSuggestionPins = (value: unknown): Array<{ second: number; label: string }> =>
  (Array.isArray(value) ? value : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const pin = entry as Record<string, unknown>;
      const second = Math.max(0, Math.round(asFiniteNumber(pin.second ?? pin.time, Number.NaN)));
      const label = String(pin.label ?? pin.text ?? "").trim();
      if (!Number.isFinite(second) || !label) return null;
      return { second, label };
    })
    .filter((entry): entry is { second: number; label: string } => Boolean(entry));

const normalizeFeedbackAnalysis = (value: unknown): FeedbackAnalysis => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const visualsRaw = source.visuals && typeof source.visuals === "object" ? (source.visuals as Record<string, unknown>) : {};
  const trendInsightsRaw = Array.isArray(source.trendInsights)
    ? source.trendInsights
    : Array.isArray(source.trend_insights)
    ? source.trend_insights
    : [];

  return {
    detectedNiche: String(source.detectedNiche ?? source.detected_niche ?? source.niche ?? "podcast / commentary").trim() || "podcast / commentary",
    detectedTopics: asStringArray(source.detectedTopics ?? source.detected_topics),
    trendingTopics: asStringArray(source.trendingTopics ?? source.trending_topics),
    voicePerformance: asStringArray(source.voicePerformance ?? source.voice_performance),
    positioningAngle: asStringArray(source.positioningAngle ?? source.positioning_angle),
    contentTips: asStringArray(source.contentTips ?? source.content_tips),
    retentionBoosts: asStringArray(source.retentionBoosts ?? source.retention_boosts),
    trendInsights: trendInsightsRaw.map(normalizeTrendInsight).filter((entry): entry is TrendInsight => Boolean(entry)),
    retentionBoostEstimatePercent: clamp(
      Math.round(asFiniteNumber(source.retentionBoostEstimatePercent ?? source.retention_boost_estimate_percent, 12)),
      0,
      100,
    ),
    visuals: {
      retentionCurve: normalizeRetentionCurve(visualsRaw.retentionCurve ?? visualsRaw.retention_curve),
      suggestionPins: normalizeSuggestionPins(visualsRaw.suggestionPins ?? visualsRaw.suggestion_pins),
    },
  };
};

const formatDuration = (seconds: number | null | undefined) => {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "Unknown";
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
};

const formatNicheLabel = (value: string) =>
  String(value || "")
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const readVideoDuration = (file: File) =>
  new Promise<number>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    video.onloadedmetadata = () => {
      const value = Number(video.duration);
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(value) ? Math.max(0, value) : 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });

const Feedback = () => {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { data: me, isLoading: loadingMe } = useMe();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<FeedbackJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackAnalysis | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [uploadedDurationSeconds, setUploadedDurationSeconds] = useState<number>(0);
  const [manualTranscript, setManualTranscript] = useState<string>("");
  const [dropActive, setDropActive] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) || null;

  const tier = String(me?.subscription?.tier || "free").toLowerCase();
  const isDev = Boolean(me?.flags?.dev);
  const isPremium = isDev || tier !== "free";

  useEffect(() => {
    if (!accessToken || loadingMe || !isPremium) return;
    let cancelled = false;
    const run = async () => {
      try {
        setLoadingJobs(true);
        const result = await apiFetch<{ jobs: FeedbackJob[] }>("/api/feedback/jobs", { token: accessToken });
        if (cancelled) return;
        setJobs(Array.isArray(result.jobs) ? result.jobs : []);
      } catch (error: any) {
        if (!cancelled) {
          toast({
            title: "Could not load past jobs",
            description: error?.message || "Try again in a moment.",
          });
        }
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [accessToken, loadingMe, isPremium, toast]);

  useEffect(() => {
    if (selectedJobId || !jobs.length) return;
    setSelectedJobId(jobs[0].id);
  }, [jobs, selectedJobId]);

  useEffect(() => {
    if (loadingMe || isPremium) return;
    const timer = window.setTimeout(() => {
      navigate("/pricing", { replace: true });
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [loadingMe, isPremium, navigate]);

  if (loadingMe) {
    return (
      <GlowBackdrop>
        <Navbar />
        <main className="responsive-main min-h-screen px-4 pb-16 pt-24">
          <div className="mx-auto flex max-w-4xl items-center justify-center rounded-3xl border border-white/10 bg-black/30 p-10 backdrop-blur-xl">
            <Loader2 className="h-6 w-6 animate-spin text-purple-300" />
            <span className="ml-3 text-sm text-slate-300">Loading feedback access...</span>
          </div>
        </main>
      </GlowBackdrop>
    );
  }

  const pickVideoFile = () => fileRef.current?.click();

  const onFileSelected = async (file: File | null) => {
    if (!file) return;
    setSelectedJobId("");
    setUploadedFileName(file.name);
    const duration = await readVideoDuration(file);
    setUploadedDurationSeconds(duration);
  };

  const handleAnalyze = async () => {
    if (!accessToken) return;
    if (!selectedJobId && !uploadedFileName) {
      toast({ title: "Select a source", description: "Choose a completed job or upload a video file first." });
      return;
    }
    try {
      setAnalyzing(true);
      const body = selectedJobId
        ? { jobId: selectedJobId }
        : {
            uploadSummary: {
              fileName: uploadedFileName,
              durationSeconds: uploadedDurationSeconds,
              transcript: manualTranscript,
              metadata: { source: "feedback_upload" },
            },
          };
      const result = await apiFetch<FeedbackResponse>("/api/feedback/analyze", {
        method: "POST",
        body: JSON.stringify(body),
        token: accessToken,
      });
      setFeedback(normalizeFeedbackAnalysis(result.feedback));
      toast({ title: "Feedback ready", description: "AI trend and retention insights have been generated." });
    } catch (error: any) {
      if (error instanceof ApiError && error.code === "PREMIUM_REQUIRED") {
        navigate("/pricing");
        return;
      }
      toast({
        title: "Analysis failed",
        description: error?.message || "Please try again.",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  if (!isPremium) {
    return (
      <GlowBackdrop>
        <Navbar />
        <main className="responsive-main min-h-screen px-4 pb-16 pt-24">
          <div className="mx-auto max-w-4xl rounded-3xl border border-purple-500/35 bg-[linear-gradient(145deg,rgba(15,15,30,0.92),rgba(11,13,25,0.92))] p-8 shadow-[0_35px_110px_-60px_rgba(168,85,247,0.8)] backdrop-blur-xl">
            <Badge className="border border-purple-400/40 bg-purple-500/15 text-purple-100">Premium Feature</Badge>
            <h1 className="mt-4 text-3xl font-bold text-white">AI Feedback on Your Video</h1>
            <p className="mt-2 text-sm text-slate-300">
              Upgrade to unlock transcript-driven feedback, niche trends, retention insights, and visual suggestion pins.
            </p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-slate-200">
              Free tier users are redirected to pricing. Paid and dev users get full feedback + trend intelligence.
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild className="rounded-xl bg-gradient-to-r from-[#A855F7] to-cyan-400 text-white hover:brightness-110">
                <Link to="/pricing">Upgrade to Unlock Feedback</Link>
              </Button>
              <p className="text-xs text-slate-400">Redirecting to pricing...</p>
            </div>
          </div>
        </main>
      </GlowBackdrop>
    );
  }

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main min-h-screen px-4 pb-20 pt-24">
        <motion.section
          className="mx-auto max-w-6xl rounded-3xl border border-purple-500/35 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_46%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.16),transparent_52%),linear-gradient(145deg,rgba(11,13,25,0.92),rgba(7,10,22,0.92))] p-6 shadow-[0_30px_100px_-56px_rgba(168,85,247,0.8)] backdrop-blur-xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42 }}
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-purple-200/80">Premium Intelligence</p>
              <h1 className="mt-2 bg-gradient-to-r from-[#A855F7] via-purple-300 to-cyan-300 bg-clip-text text-3xl font-bold text-transparent">
                AI Feedback on Your Video
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Transcript + metadata + energy signals + live trend scouting for niche-specific retention improvements.
              </p>
            </div>
            <Badge className="border border-cyan-300/40 bg-cyan-400/12 text-cyan-100">
              {isDev ? "Dev God-Mode" : "Premium"}
            </Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-purple-500/30 bg-black/25 p-4 backdrop-blur-md">
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-purple-200/80">Upload / Select</p>
              <div
                role="button"
                tabIndex={0}
                onClick={pickVideoFile}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDropActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDropActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDropActive(false);
                  const dropped = event.dataTransfer?.files?.[0] ?? null;
                  void onFileSelected(dropped);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    pickVideoFile();
                  }
                }}
                className={`rounded-2xl border border-dashed bg-gradient-to-br from-purple-500/12 to-cyan-400/10 p-5 text-center transition hover:border-purple-300/70 hover:shadow-[0_0_24px_rgba(168,85,247,0.35)] ${
                  dropActive ? "border-purple-200/85 shadow-[0_0_30px_rgba(168,85,247,0.55)]" : "border-purple-400/40"
                }`}
              >
                <Upload className="mx-auto h-6 w-6 text-purple-200" />
                <p className="mt-2 text-sm font-medium text-slate-100">Drop a video or click to upload</p>
                <p className="mt-1 text-xs text-slate-400">Use uploaded file summary or choose a completed job for full transcript signals.</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/m4v,video/x-matroska,.mp4,.m4v,.mkv"
                className="hidden"
                onChange={(event) => void onFileSelected(event.target.files?.[0] ?? null)}
              />
              {uploadedFileName ? (
                <div className="mt-3 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
                  Uploaded: {uploadedFileName} ({formatDuration(uploadedDurationSeconds)})
                </div>
              ) : null}
              <label className="mt-3 block text-xs text-slate-300">
                Optional transcript/context
                <textarea
                  value={manualTranscript}
                  onChange={(event) => setManualTranscript(event.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-300/60"
                  placeholder="Paste transcript, keywords, or content notes..."
                />
              </label>
            </div>

            <div className="rounded-2xl border border-purple-500/30 bg-black/25 p-4 backdrop-blur-md">
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-purple-200/80">Past Jobs</p>
              <select
                value={selectedJobId}
                onChange={(event) => {
                  setSelectedJobId(event.target.value);
                  if (event.target.value) {
                    setUploadedFileName("");
                    setUploadedDurationSeconds(0);
                  }
                }}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">Select completed job (optional)</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} • {formatDate(job.createdAt)} • {formatDuration(job.durationSeconds)}
                  </option>
                ))}
              </select>
              <div className="mt-3 text-xs text-slate-400">
                {loadingJobs
                  ? "Loading completed jobs..."
                  : selectedJob
                  ? `Selected: ${selectedJob.title}`
                  : "Tip: choose a completed render for best transcript + energy precision."}
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#A855F7] to-purple-400 text-white shadow-[0_0_22px_rgba(168,85,247,0.45)] hover:brightness-110"
              >
                {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                Get Feedback
              </Button>
            </div>
          </div>
        </motion.section>

        {feedback ? (
          <motion.section
            className="mx-auto mt-6 max-w-6xl space-y-4"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="rounded-2xl border border-purple-500/35 bg-black/30 p-4 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-purple-300/50 bg-purple-400/15 text-purple-100">
                  Detected Niche: {formatNicheLabel(feedback.detectedNiche)}
                </Badge>
                {feedback.detectedTopics.slice(0, 4).map((topic) => (
                  <Badge key={topic} className="border border-cyan-300/40 bg-cyan-400/12 text-cyan-100">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-purple-500/35 bg-black/30 p-4 backdrop-blur-md">
              <h3 className="mb-3 bg-gradient-to-r from-[#A855F7] to-cyan-300 bg-clip-text text-2xl font-bold text-transparent">
                AI Trend Analysis for Your Video 🔥
              </h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {feedback.trendInsights.slice(0, 6).map((trend, index) => (
                  <motion.article
                    key={`${trend.title}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-2xl border border-purple-400/35 bg-gradient-to-br from-purple-500/14 to-cyan-400/10 p-3 transition hover:shadow-[0_0_20px_rgba(168,85,247,0.35)]"
                  >
                    <p className="text-sm font-semibold text-slate-100">{trend.title}</p>
                    <p className="mt-1 text-xs text-slate-300">{trend.summary}</p>
                    <p className="mt-2 text-xs text-cyan-100">How to apply: {trend.howToApply}</p>
                    {trend.url ? (
                      <a href={trend.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[11px] text-purple-200 underline">
                        Source
                      </a>
                    ) : null}
                  </motion.article>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-300">
                  Retention boost estimate from trend alignment: +{feedback.retentionBoostEstimatePercent}%
                </p>
                <Button asChild variant="outline" className="border-purple-400/35 bg-purple-500/10 text-purple-100 hover:bg-purple-500/20">
                  <Link to="/settings">Upgrade Effects to Match Trends</Link>
                </Button>
              </div>
            </div>

            <Accordion type="multiple" className="space-y-3">
              <AccordionItem value="niche" className="rounded-2xl border border-purple-500/35 bg-black/30 px-4">
                <AccordionTrigger className="text-slate-100 hover:no-underline">Niche Detection</AccordionTrigger>
                <AccordionContent className="text-sm text-slate-300">
                  Your video's niche: {formatNicheLabel(feedback.detectedNiche)}. Trending topics: {feedback.trendingTopics.join(", ")}.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="voice" className="rounded-2xl border border-purple-500/35 bg-black/30 px-4">
                <AccordionTrigger className="text-slate-100 hover:no-underline">Voice / Performance</AccordionTrigger>
                <AccordionContent className="space-y-1 text-sm text-slate-300">
                  {feedback.voicePerformance.map((line, index) => (
                    <p key={`voice-${index}`}>- {line}</p>
                  ))}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="positioning" className="rounded-2xl border border-purple-500/35 bg-black/30 px-4">
                <AccordionTrigger className="text-slate-100 hover:no-underline">Positioning / Angle</AccordionTrigger>
                <AccordionContent className="space-y-1 text-sm text-slate-300">
                  {feedback.positioningAngle.map((line, index) => (
                    <p key={`pos-${index}`}>- {line}</p>
                  ))}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="content" className="rounded-2xl border border-purple-500/35 bg-black/30 px-4">
                <AccordionTrigger className="text-slate-100 hover:no-underline">Content Tips</AccordionTrigger>
                <AccordionContent className="space-y-1 text-sm text-slate-300">
                  {feedback.contentTips.map((line, index) => (
                    <p key={`content-${index}`}>- {line}</p>
                  ))}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="retention" className="rounded-2xl border border-purple-500/35 bg-black/30 px-4">
                <AccordionTrigger className="text-slate-100 hover:no-underline">Retention Boosts</AccordionTrigger>
                <AccordionContent className="space-y-1 text-sm text-slate-300">
                  {feedback.retentionBoosts.map((line, index) => (
                    <p key={`ret-${index}`}>- {line}</p>
                  ))}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="visuals" className="rounded-2xl border border-purple-500/35 bg-black/30 px-4">
                <AccordionTrigger className="text-slate-100 hover:no-underline">Visuals</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">Retention Curve</p>
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={feedback.visuals.retentionCurve}>
                            <XAxis dataKey="second" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                            <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                            <Tooltip
                              formatter={(value: any) => [`${value}%`, "Retention"]}
                              labelFormatter={(label) => `${label}s`}
                              contentStyle={{
                                backgroundColor: "rgba(15,23,42,0.92)",
                                border: "1px solid rgba(168,85,247,0.45)",
                                borderRadius: "10px",
                              }}
                            />
                            <Line type="monotone" dataKey="score" stroke="#A855F7" strokeWidth={2.6} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">Timeline Suggestion Pins</p>
                      <div className="space-y-2 text-xs text-slate-300">
                        {feedback.visuals.suggestionPins.length ? (
                          feedback.visuals.suggestionPins.map((pin, index) => (
                            <div key={`${pin.second}-${index}`} className="rounded-lg border border-purple-400/25 bg-purple-500/10 p-2">
                              <p className="text-purple-100">{pin.second}s</p>
                              <p>{pin.label}</p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400">
                            No major retention dips found. Keep the current pacing and add one extra micro-hook around minute 1.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </motion.section>
        ) : (
          <section className="mx-auto mt-6 max-w-6xl rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
            <div className="flex items-center gap-2 text-slate-200">
              <TrendingUp className="h-4 w-4 text-purple-300" />
              Run feedback to get niche trends, retention curve, and personalized editing recommendations.
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              Render as premium glass cards with glow hover.
            </div>
          </section>
        )}
      </main>
    </GlowBackdrop>
  );
};

export default Feedback;
