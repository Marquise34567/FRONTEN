import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Sparkles, TrendingUp } from "lucide-react";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import SeoHead from "@/components/SeoHead";
import { useAuth } from "@/providers/AuthProvider";
import { useSubscription } from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";
import { ApiError, apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

type PremiumTitleLengthStatus = "optimal" | "strong" | "outside" | "too_long";

type PremiumGeneratedTitle = {
  title: string;
  formula: string;
  whyItShouldWork: string;
  predictedCtrBand: string;
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
  framework: PremiumTitleFrameworkRow[];
};

const DEFAULT_FRAMEWORK: PremiumTitleFrameworkRow[] = [
  {
    section: "Titles",
    signal: "Optimal Length",
    baseline: "Too long (>70 char)",
    optimized: "45-55 char (~8 words median)",
    elite: "40-60 char range",
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

const premiumPanelClass =
  "border border-amber-200/15 bg-gradient-to-br from-slate-950/85 via-slate-900/80 to-zinc-950/85 shadow-[0_18px_70px_-34px_rgba(250,204,21,0.48)] backdrop-blur";

const PremiumTitleGenerator = () => {
  const { accessToken } = useAuth();
  const { plan, loading: subscriptionLoading } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [videoSummary, setVideoSummary] = useState("");
  const [thumbnailContext, setThumbnailContext] = useState("");
  const [previousTitles, setPreviousTitles] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [count, setCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PremiumTitleGeneratorResponse | null>(null);

  const premiumUnlocked = plan !== "free";
  const frameworkRows = useMemo(
    () => (result?.framework?.length ? result.framework : DEFAULT_FRAMEWORK),
    [result?.framework]
  );

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
    setLoading(true);
    try {
      const payload = await apiFetch<PremiumTitleGeneratorResponse>("/api/intelligence/premium-title-generator", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          topic: cleanTopic,
          videoSummary: videoSummary.trim(),
          thumbnailContext: thumbnailContext.trim(),
          previousWinningTitles: splitPreviousTitles(previousTitles),
          targetAudience: targetAudience.trim(),
          count,
        }),
      });
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
          <div className="rounded-2xl border border-amber-200/20 bg-gradient-to-br from-zinc-950/85 via-slate-900/80 to-zinc-900/80 p-5 shadow-[0_24px_80px_-36px_rgba(250,204,21,0.45)] sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border border-amber-300/40 bg-amber-500/15 text-amber-100">Premium Tool</Badge>
              <Badge variant="outline" className="border-cyan-300/35 bg-cyan-500/10 text-cyan-100">
                {subscriptionLoading ? "Checking plan..." : premiumUnlocked ? `Plan: ${plan}` : "Plan: free"}
              </Badge>
            </div>
            <h1 className="mt-3 text-3xl font-bold font-display tracking-tight text-foreground sm:text-4xl">Premium Title Generator</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground/95">
              Generate title variants for any topic with Gemini using your 2026 CTR framework: length control, odd-number bias,
              emotional triggers, thumbnail-title synergy, and A/B testing logic.
            </p>
          </div>
        </motion.div>

        <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[0.98fr_1.02fr]">
          <Card className={premiumPanelClass}>
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-lg font-display tracking-tight">Generate</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/90">
                Compact inputs for faster packaging ideation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Video Topic</p>
                <Input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="Example: faceless YouTube automation with AI tools"
                  maxLength={220}
                  className="h-9 border-amber-100/20 bg-black/20 text-sm placeholder:text-muted-foreground/60"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Video Summary (optional)</p>
                <Textarea
                  value={videoSummary}
                  onChange={(event) => setVideoSummary(event.target.value)}
                  placeholder="Briefly describe what the viewer will learn, outcome, and tone."
                  rows={2}
                  maxLength={1600}
                  className="min-h-[68px] border-amber-100/20 bg-black/20 text-sm placeholder:text-muted-foreground/60"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Thumbnail Context (optional)</p>
                <Textarea
                  value={thumbnailContext}
                  onChange={(event) => setThumbnailContext(event.target.value)}
                  placeholder='Example: Thumbnail text says "99% Fail". Image shows shocked face + red arrow.'
                  rows={2}
                  maxLength={360}
                  className="min-h-[68px] border-amber-100/20 bg-black/20 text-sm placeholder:text-muted-foreground/60"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Previous Winning Titles (optional)</p>
                <Textarea
                  value={previousTitles}
                  onChange={(event) => setPreviousTitles(event.target.value)}
                  placeholder="Paste one title per line from your channel that already performed well."
                  rows={3}
                  maxLength={2200}
                  className="min-h-[86px] border-amber-100/20 bg-black/20 text-sm placeholder:text-muted-foreground/60"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Target Audience</p>
                  <Input
                    value={targetAudience}
                    onChange={(event) => setTargetAudience(event.target.value)}
                    placeholder="Example: beginner creators"
                    maxLength={180}
                    className="h-9 border-amber-100/20 bg-black/20 text-sm placeholder:text-muted-foreground/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Variant Count</p>
                  <select
                    value={count}
                    onChange={(event) => setCount(Number(event.target.value))}
                    className="h-9 w-full rounded-md border border-amber-100/20 bg-black/25 px-3 text-sm text-foreground"
                  >
                    <option value={5}>5 variants</option>
                    <option value={8}>8 variants</option>
                    <option value={10}>10 variants</option>
                    <option value={12}>12 variants</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1.5">
                <Button
                  onClick={() => void handleGenerate()}
                  disabled={loading || !premiumUnlocked || !topic.trim()}
                  className="h-9 gap-2 bg-amber-300/90 px-4 text-black hover:bg-amber-200"
                >
                  <Sparkles className="h-4 w-4" />
                  {loading ? "Generating..." : "Generate Premium Titles"}
                </Button>
                {!premiumUnlocked ? (
                  <Link to="/pricing" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                    Upgrade to Starter+ to unlock this tool
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className={premiumPanelClass}>
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-lg font-display tracking-tight">2026 Framework</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/90">
                Compact scorecard used by the generator.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {frameworkRows.map((row) => (
                <div
                  key={`${row.section}-${row.signal}`}
                  className="rounded-lg border border-amber-100/15 bg-black/25 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{row.section}</p>
                    <p className="text-[10px] text-muted-foreground/80">2026</p>
                  </div>
                  <p className="mt-1 text-[13px] font-semibold leading-4 text-foreground">{row.signal}</p>
                  <div className="mt-1.5 grid grid-cols-[auto,1fr] gap-x-2 gap-y-1 text-[11px] leading-4">
                    <span className="text-muted-foreground/90">Base</span>
                    <span className="text-muted-foreground">{row.baseline}</span>
                    <span className="text-muted-foreground/90">Opt</span>
                    <span className="text-muted-foreground">{row.optimized}</span>
                    <span className="text-muted-foreground/90">Elite</span>
                    <span className="text-foreground/90">{row.elite}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-4 text-foreground/85">{row.example}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <section className="mx-auto mt-6 max-w-6xl space-y-4">
          <Card className={premiumPanelClass}>
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-lg font-display tracking-tight">Generated Title Variants</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/90">
                {result
                  ? `Provider: ${result.provider}${result.model ? ` (${result.model})` : ""}${result.usedFallback ? " · fallback assist active" : ""}`
                  : "Run generation to get scored title ideas."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {result?.titles?.length ? (
                result.titles.map((idea, index) => (
                  <div key={`${idea.title}-${index}`} className="rounded-xl border border-amber-100/15 bg-black/25 p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold leading-5 text-foreground">{idea.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground/95">{idea.whyItShouldWork}</p>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5 shrink-0 border-amber-100/25 bg-black/20" onClick={() => void handleCopy(idea.title)}>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary-foreground">
                        Score {idea.score}
                      </Badge>
                      <Badge variant="outline">{idea.charCount} chars</Badge>
                      <Badge variant="outline">{idea.wordCount} words</Badge>
                      <Badge variant="outline" className={statusClass(idea.lengthStatus)}>
                        {statusLabel(idea.lengthStatus)}
                      </Badge>
                      {idea.hasOddNumber ? <Badge className="border border-emerald-300/40 bg-emerald-500/15 text-emerald-100">Odd Number</Badge> : null}
                      {idea.powerWordHits.length ? (
                        <Badge className="border border-fuchsia-300/35 bg-fuchsia-500/15 text-fuchsia-100">
                          Power Words: {idea.powerWordHits.slice(0, 2).join(", ")}
                        </Badge>
                      ) : null}
                    </div>
                    <Separator className="my-3" />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Formula:</span> {idea.formula}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">CTR Band:</span> {idea.predictedCtrBand}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-amber-100/25 bg-black/15 p-5 text-sm text-muted-foreground">
                  No titles yet. Add your topic and click <span className="font-medium text-foreground">Generate Premium Titles</span>.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={premiumPanelClass}>
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-lg flex items-center gap-2 font-display tracking-tight">
                <TrendingUp className="h-4 w-4 text-emerald-300" />
                Thumbnail + Testing Guidance
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground/90">Use these immediately after you publish.</CardDescription>
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
