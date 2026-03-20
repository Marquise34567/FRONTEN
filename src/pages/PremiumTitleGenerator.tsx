import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Sparkles, TrendingUp } from "lucide-react";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import SeoHead from "@/components/SeoHead";
import { useAuth } from "@/providers/AuthProvider";
import { useMe } from "@/hooks/use-me";
import { useSubscription } from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";
import { ApiError, apiFetch, getApiBaseCandidates } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PremiumTitleLengthStatus = "optimal" | "strong" | "outside" | "too_long";

type PremiumGeneratedTitle = {
  title: string;
  formula: string;
  whyItShouldWork: string;
  predictedCtrBand: string;
  hookScript: string;
  thumbnailIdea: string;
  isEmotionalBanger: boolean;
  score: number;
  charCount: number;
  wordCount: number;
  hasNumber: boolean;
  hasOddNumber: boolean;
  powerWordHits: string[];
  lengthStatus: PremiumTitleLengthStatus;
};

type PremiumTitleFrameworkRow = {
  section: "Titles" | "General Combo";
  signal: string;
  baseline: string;
  optimized: string;
  elite: string;
  example: string;
  source: string;
};

type PremiumTitleGeneratorResponse = {
  ok: true;
  provider: "gemini" | "heuristic";
  model: string | null;
  usedFallback: boolean;
  generatedAt: string;
  titles: PremiumGeneratedTitle[];
  thumbnailSynergyTip: string;
  abTestPlan: string[];
  notes: string;
  visionUsed: boolean;
  visionFrameCount: number;
  framework: PremiumTitleFrameworkRow[];
};

const DEFAULT_FRAMEWORK: PremiumTitleFrameworkRow[] = [
  {
    section: "Titles",
    signal: "Optimal Length",
    baseline: "Too long (>50 char)",
    optimized: "30-48 char mobile-safe",
    elite: "Under 50 with strong punch",
    example: "7 Mistakes That Cost Me $10,000",
    source: "Subsub.io 120k titles; Humble&Brag; mobile truncation",
  },
  {
    section: "Titles",
    signal: "CTR Lift from Numbers/Odd Numbers",
    baseline: "No number in title",
    optimized: "20-40% higher CTR with numbers",
    elite: "Odd numbers (7, 9, 3) perform best",
    example: "10 Secrets to 10x Views / 3 Things I Wish I Knew",
    source: "CoSchedule/VidIQ; pattern interruption",
  },
  {
    section: "Titles",
    signal: "Power Words and Emotional Triggers",
    baseline: "Neutral wording",
    optimized: "Words like Ultimate/Surprising/Insane",
    elite: "High emotion + curiosity gap",
    example: "This Changed My Life Overnight",
    source: "Fluxnote formulas; YouTube psychology (2026)",
  },
  {
    section: "Titles",
    signal: "Top Formulas 2026",
    baseline: "Generic keyword-heavy phrasing",
    optimized: "Specific promise + curiosity",
    elite: "Outcome + time/method framing",
    example: "How I Made $XXX in 30 Days",
    source: "Fluxnote 25 formulas; Humble&Brag best titles",
  },
  {
    section: "Titles",
    signal: "Best Practices",
    baseline: "Duplicate thumbnail message",
    optimized: "Complement thumbnail with context",
    elite: "Promise + specificity",
    example: "I Tried This... And Regretted It Instantly",
    source: "CareerFoundry tests; 1-2% CTR lift",
  },
  {
    section: "General Combo",
    signal: "CTR Benchmarks",
    baseline: "3-4% average",
    optimized: "4-6% good",
    elite: "7-10%+ viral range",
    example: "Top creators hit 5-10% via testing",
    source: "Ampifire/EntreResource",
  },
  {
    section: "General Combo",
    signal: "A/B Testing Impact",
    baseline: "Guesswork",
    optimized: "Test 2-3 variants",
    elite: "Data-driven winner (watch-time weighted)",
    example: "1-2% CTR changes are common and meaningful",
    source: "VidIQ/ThumbnailTest; YouTube Test & Compare",
  },
];

const splitPreviousTitles = (value: string) =>
  value
    .split(/\r?\n|;/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

const statusLabel = (status: PremiumTitleLengthStatus) => {
  if (status === "optimal") return "Optimal Length";
  if (status === "strong") return "Strong Length";
  if (status === "too_long") return "Too Long";
  return "Outside Range";
};

const statusClass = (status: PremiumTitleLengthStatus) => {
  if (status === "optimal") return "bg-emerald-500/15 text-emerald-200 border-emerald-400/30";
  if (status === "strong") return "bg-sky-500/15 text-sky-200 border-sky-400/30";
  if (status === "too_long") return "bg-rose-500/15 text-rose-200 border-rose-400/30";
  return "bg-amber-500/15 text-amber-200 border-amber-400/30";
};

const PremiumTitleGenerator = () => {
  const { accessToken } = useAuth();
  const { data: me } = useMe();
  const { plan, loading: subscriptionLoading } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [videoSummary, setVideoSummary] = useState("");
  const [thumbnailContext, setThumbnailContext] = useState("");
  const [previousTitles, setPreviousTitles] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [peakEmotionQuote, setPeakEmotionQuote] = useState("");
  const [ahaMoment, setAhaMoment] = useState("");
  const [villain, setVillain] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PremiumTitleGeneratorResponse | null>(null);

  const isDevAccount = Boolean(me?.flags?.dev);
  const premiumUnlocked = plan !== "free" || isDevAccount;
  const frameworkRows = useMemo(
    () => (result?.framework?.length ? result.framework : DEFAULT_FRAMEWORK),
    [result?.framework]
  );
  const quickChecklist = useMemo(() => frameworkRows.slice(0, 5), [frameworkRows]);

  const handleCopy = async (title: string) => {
    try {
      await navigator.clipboard.writeText(title);
      toast({ title: "Copied", description: "Title copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard write failed on this browser." });
    }
  };

  const handleGenerate = async () => {
    const cleanTopic = topic.trim();
    if (!cleanTopic) {
      toast({ title: "Missing topic", description: "Add a topic to generate premium titles." });
      return;
    }
    if (!premiumUnlocked) {
      toast({ title: "Premium feature", description: "Upgrade to unlock Premium Title Generator." });
      navigate("/pricing");
      return;
    }
    if (!accessToken) {
      toast({ title: "Not authenticated", description: "Please sign in and try again." });
      return;
    }
    if (videoFile) {
      if (!String(videoFile.type || "").startsWith("video/")) {
        toast({ title: "Invalid file", description: "Upload a video file (mp4, mov, mkv, webm)." });
        return;
      }
      const maxBytes = 1024 * 1024 * 1024;
      if (videoFile.size > maxBytes) {
        toast({ title: "Video too large", description: "Use a clip up to 1GB for Gemini Vision skim." });
        return;
      }
    }
    setLoading(true);
    try {
      let payload: PremiumTitleGeneratorResponse;
      const trimmedVideoSummary = videoSummary.trim();
      const trimmedThumbContext = thumbnailContext.trim();
      const trimmedAudience = targetAudience.trim();
      const trimmedInstructions = extraInstructions.trim();
      const trimmedPeakQuote = peakEmotionQuote.trim();
      const trimmedAhaMoment = ahaMoment.trim();
      const trimmedVillain = villain.trim();
      const winningTitles = splitPreviousTitles(previousTitles);

      if (videoFile) {
        const formData = new FormData();
        formData.append("topic", cleanTopic);
        formData.append("videoSummary", trimmedVideoSummary);
        formData.append("thumbnailContext", trimmedThumbContext);
        formData.append("previousWinningTitles", JSON.stringify(winningTitles));
        formData.append("targetAudience", trimmedAudience);
        formData.append("extraInstructions", trimmedInstructions);
        formData.append("peakEmotionQuote", trimmedPeakQuote);
        formData.append("ahaMoment", trimmedAhaMoment);
        formData.append("villain", trimmedVillain);
        formData.append("count", String(count));
        formData.append("video", videoFile);

        const apiBase = getApiBaseCandidates()[0] || "";
        const endpoint = `${apiBase}/api/intelligence/premium-title-generator`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
          credentials: "include",
        });
        const raw = await response.text();
        let parsed: any = {};
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          parsed = { error: "invalid_json", message: raw || "Invalid server response" };
        }
        if (!response.ok) {
          throw new ApiError(
            parsed?.message || parsed?.reason || parsed?.error || `HTTP ${response.status}`,
            response.status,
            parsed?.error,
            parsed
          );
        }
        payload = parsed as PremiumTitleGeneratorResponse;
      } else {
        payload = await apiFetch<PremiumTitleGeneratorResponse>("/api/intelligence/premium-title-generator", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({
            topic: cleanTopic,
            videoSummary: trimmedVideoSummary,
            thumbnailContext: trimmedThumbContext,
            previousWinningTitles: winningTitles,
            targetAudience: trimmedAudience,
            extraInstructions: trimmedInstructions,
            peakEmotionQuote: trimmedPeakQuote,
            ahaMoment: trimmedAhaMoment,
            villain: trimmedVillain,
            count,
          }),
        });
      }
      setResult(payload);
      toast({ title: "Titles generated", description: `Generated ${payload.titles.length} title variants.` });
    } catch (error: any) {
      if (error instanceof ApiError && error.code === "PLAN_LIMIT_EXCEEDED") {
        toast({ title: "Premium feature", description: "Upgrade to unlock Premium Title Generator." });
        navigate("/pricing");
      } else {
        toast({ title: "Generation failed", description: error?.message || "Please retry in a moment." });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlowBackdrop>
      <SeoHead
        title="Premium Title Generator | AutoEditor"
        description="Generate high-CTR YouTube titles using 2026 premium title frameworks, thumbnail synergy, and A/B testing patterns."
        path="/title-generator"
        noindex
      />
      <Navbar />
      <main className="responsive-main min-h-screen px-4 pb-20 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mx-auto mb-6 max-w-6xl"
        >
          <div className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border border-emerald-300/30 bg-emerald-500/15 text-emerald-100">Premium Tool</Badge>
              <Badge variant="outline" className="border-cyan-300/30 bg-cyan-500/10 text-cyan-100">
                {subscriptionLoading
                  ? "Checking plan..."
                  : isDevAccount
                    ? plan === "free"
                      ? "Plan: free (dev unlocked)"
                      : `Plan: ${plan} (dev)`
                    : premiumUnlocked
                      ? `Plan: ${plan}`
                      : "Plan: free"}
              </Badge>
            </div>
            <h1 className="mt-3 text-3xl font-bold font-display text-foreground sm:text-4xl">Premium Title Generator</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Mini-list workflow: enter topic, generate, copy. Expand advanced fields only when needed.
            </p>
          </div>
        </motion.div>

        <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-border/60 bg-card/60">
            <CardHeader>
              <CardTitle className="text-xl">Quick Generate</CardTitle>
              <CardDescription>Fast path first. Use Advanced only when you want tighter targeting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Topic</p>
                  <Input
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="What is this video about?"
                    maxLength={220}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Variants</p>
                  <select
                    value={count}
                    onChange={(event) => setCount(Number(event.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value={5}>5 variants</option>
                    <option value={8}>8 variants</option>
                    <option value={10}>10 variants</option>
                    <option value={12}>12 variants</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Action</p>
                  <Button
                    onClick={() => void handleGenerate()}
                    disabled={loading || !premiumUnlocked || !topic.trim()}
                    className="w-full gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    {loading ? "Generating..." : "Generate"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Target Audience (optional)</p>
                  <Input
                    value={targetAudience}
                    onChange={(event) => setTargetAudience(event.target.value)}
                    placeholder="Example: beginner creators"
                    maxLength={180}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Video Upload For Gemini Vision (optional)</p>
                  <Input
                    type="file"
                    accept="video/*"
                    onChange={(event) => setVideoFile(event.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max 1GB{videoFile ? ` · ${videoFile.name}` : ""}.
                  </p>
                </div>
              </div>

              <details className="rounded-lg border border-border/60 bg-background/35 p-3">
                <summary className="cursor-pointer text-sm font-medium text-foreground">Advanced Context (optional)</summary>
                <div className="mt-3 space-y-3">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Video Summary</p>
                    <Textarea
                      value={videoSummary}
                      onChange={(event) => setVideoSummary(event.target.value)}
                      placeholder="Brief summary of what happens in this video."
                      rows={2}
                      maxLength={1600}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      value={peakEmotionQuote}
                      onChange={(event) => setPeakEmotionQuote(event.target.value)}
                      placeholder='Peak emotion quote'
                      maxLength={240}
                    />
                    <Input
                      value={ahaMoment}
                      onChange={(event) => setAhaMoment(event.target.value)}
                      placeholder="Aha moment"
                      maxLength={240}
                    />
                    <Input
                      value={villain}
                      onChange={(event) => setVillain(event.target.value)}
                      placeholder="Villain (e.g., low views)"
                      maxLength={140}
                    />
                  </div>
                  <Textarea
                    value={thumbnailContext}
                    onChange={(event) => setThumbnailContext(event.target.value)}
                    placeholder="Thumbnail context"
                    rows={2}
                    maxLength={360}
                  />
                  <Textarea
                    value={previousTitles}
                    onChange={(event) => setPreviousTitles(event.target.value)}
                    placeholder="Previous winning titles (one per line)"
                    rows={3}
                    maxLength={2200}
                  />
                  <Textarea
                    value={extraInstructions}
                    onChange={(event) => setExtraInstructions(event.target.value)}
                    placeholder="Extra instructions"
                    rows={2}
                    maxLength={420}
                  />
                </div>
              </details>

              <div className="flex flex-wrap items-center gap-3">
                {!premiumUnlocked ? (
                  <Link to="/pricing" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                    Upgrade to Starter+ to unlock this tool
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60">
            <CardHeader>
              <CardTitle className="text-xl">Mini Playbook</CardTitle>
              <CardDescription>Quick reminders while you package titles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickChecklist.map((row) => (
                <div key={`${row.section}-${row.signal}`} className="rounded-lg border border-border/60 bg-background/40 p-2.5">
                  <p className="text-xs font-medium text-foreground">{row.signal}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Elite: {row.elite}</p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Focus order: Hook first, clarity second, novelty third.
              </p>
            </CardContent>
          </Card>
        </div>

        <section className="mx-auto mt-6 max-w-6xl space-y-4">
          <Card className="border-border/60 bg-card/60">
            <CardHeader>
              <CardTitle className="text-xl">Generated Mini List</CardTitle>
              <CardDescription>
                {result
                  ? `Provider: ${result.provider}${result.model ? ` (${result.model})` : ""}${result.usedFallback ? " · fallback assist active" : ""}${result.visionUsed ? ` · vision frames: ${result.visionFrameCount}` : ""}`
                  : "Run generation to get scored title ideas."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {result?.titles?.length ? (
                result.titles.map((idea, index) => (
                  <div key={`${idea.title}-${index}`} className="rounded-lg border border-border/60 bg-background/35 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                        {index + 1}. {idea.title}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary-foreground">
                          {idea.score}
                        </Badge>
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5" onClick={() => void handleCopy(idea.title)}>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{idea.charCount} chars</Badge>
                      <Badge variant="outline" className={statusClass(idea.lengthStatus)}>
                        {statusLabel(idea.lengthStatus)}
                      </Badge>
                      {idea.hasOddNumber ? <Badge className="border border-emerald-300/40 bg-emerald-500/15 text-emerald-100">Odd</Badge> : null}
                      {idea.isEmotionalBanger ? (
                        <Badge className="border border-rose-300/40 bg-rose-500/15 text-rose-100">Top Pick</Badge>
                      ) : null}
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">Show details</summary>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <p>{idea.whyItShouldWork}</p>
                        <p><span className="font-medium text-foreground">Hook:</span> "{idea.hookScript}"</p>
                        <p><span className="font-medium text-foreground">Thumb:</span> {idea.thumbnailIdea}</p>
                        <p><span className="font-medium text-foreground">Formula:</span> {idea.formula}</p>
                        <p><span className="font-medium text-foreground">CTR Band:</span> {idea.predictedCtrBand}</p>
                      </div>
                    </details>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-background/25 p-6 text-sm text-muted-foreground">
                  No titles yet. Add topic and click <span className="font-medium text-foreground">Generate</span>.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-300" />
                Thumbnail + Testing Guidance
              </CardTitle>
              <CardDescription>Use these immediately after you publish.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{result?.thumbnailSynergyTip || "Use title and thumbnail as a combo: one creates curiosity, the other explains the payoff."}</p>
              {(result?.abTestPlan?.length ? result.abTestPlan : [
                "Test 2-3 title variants per upload.",
                "Track CTR and watch-time share together.",
                "A 1-2% CTR move is often worth keeping."
              ]).map((tip, index) => (
                <p key={`ab-tip-${index}`}>{index + 1}. {tip}</p>
              ))}
              {result?.notes ? <p className="text-xs text-muted-foreground/90">Note: {result.notes}</p> : null}
            </CardContent>
          </Card>
        </section>
      </main>
    </GlowBackdrop>
  );
};

export default PremiumTitleGenerator;
