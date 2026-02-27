import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/providers/AuthProvider";
import { motion } from "framer-motion";
import {
  Brain,
  Clapperboard,
  Download,
  Flame,
  ScissorsSquare,
  Sparkles,
  Target,
  WandSparkles,
} from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

const energyTimelineRaw = "16161111161616161618";
const facialZones = ["Face Zone 1 · 0:55", "Face Zone 2 · 1:30", "Face Zone 3 · 2:04", "Face Zone 4 · 3:07"];
const bingeModeActions = [
  "Added Cliffhanger Transition at 1:45",
  "Emotional Arc Pacing Applied for Binge Flow",
  "Re-Hook Inserted Every 45s to Prevent Drop-Offs",
  "Curiosity Loop at End: +20% Viewer Retention Predicted",
];

const OpenEditorCTA = ({ label }: { label: string }) => {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const target = "/editor?autopick=1";

  const handleClick = () => {
    if (!accessToken) {
      navigate(`/login?next=${encodeURIComponent(target)}`);
      return;
    }
    navigate(target);
  };

  return (
    <Button onClick={handleClick} size="lg" className="w-full gap-2 rounded-full bg-primary px-8 text-primary-foreground hover:bg-primary/90 sm:w-auto">
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
};

const Index = () => {
  const energyTimeline = useMemo(() => {
    return (energyTimelineRaw.match(/\d{1,2}/g) ?? []).map((value) => Number(value));
  }, []);

  const predictionValue = 50;
  const goalValue = 70;

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main relative min-h-screen overflow-hidden px-4 pb-24 pt-24">
        <div className="mx-auto w-full max-w-5xl">
          <motion.section
            className="glass-card overflow-hidden p-6 sm:p-8"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-6">
              <div>
                <p className="pill-badge mb-3">
                  <Sparkles className="h-3.5 w-3.5" />
                  A-MODE ANALYSIS
                </p>
                <h1 className="text-3xl font-bold font-display tracking-tight text-foreground sm:text-4xl">Full Video Scan Progress</h1>
              </div>
              <div className="rounded-xl border border-success/40 bg-success/10 px-5 py-3 text-right">
                <p className="text-3xl font-bold text-success">100%</p>
                <p className="text-xs text-success/85">Full scan 100% complete</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Scan status</span>
                <span>Ready for export</span>
              </div>
              <Progress value={100} className="h-2 bg-muted/70 [&>div]:bg-success" />
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <div className="space-y-5">
                <div className="rounded-2xl border border-border/60 bg-card/50 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Flame className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">Energy Timeline</h2>
                  </div>
                  <p className="mb-4 text-xs text-muted-foreground">0-100 score</p>
                  <div className="flex h-24 items-end gap-1.5 rounded-xl border border-border/50 bg-background/70 p-3">
                    {energyTimeline.map((value, index) => (
                      <motion.span
                        key={`${value}-${index}`}
                        className="flex-1 rounded-sm bg-primary/75"
                        style={{ height: `${Math.max(22, value * 3)}%` }}
                        initial={{ height: "0%" }}
                        animate={{ height: `${Math.max(22, value * 3)}%` }}
                        transition={{ delay: 0.15 + index * 0.045, duration: 0.35 }}
                      />
                    ))}
                  </div>
                  <p className="mt-3 font-mono text-xs tracking-[0.22em] text-muted-foreground">{energyTimelineRaw}</p>
                </div>

                <div className="rounded-2xl border border-primary/35 bg-primary/10 p-5">
                  <p className="mb-2 text-sm font-semibold text-foreground">Auto-Hook Placed: 8s High-Energy Opener</p>
                  <p className="text-xs text-muted-foreground">
                    Highest energy at 6:17 - moved to start for max retention boost
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card/55 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <ScissorsSquare className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">Auto-Cut Boring/Silent/Pauses</h2>
                  </div>
                  <p className="text-lg font-semibold text-foreground">Cut 54% low-engagement filler</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-border/60 bg-card/50 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">A-Mode</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">Advanced retention automation (facial scan + binge logic)</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card/55 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">Facial Scan Overlay</h2>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">Suggestion</p>
                  <div className="grid gap-2">
                    {facialZones.map((zone) => (
                      <div key={zone} className="rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground">
                        {zone}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card/55 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <WandSparkles className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">Binge Mode</h2>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Curiosity loops, cliffhangers, emotional arcs, dynamic pacing, and re-hooks.
                  </p>
                  <div className="space-y-2">
                    {bingeModeActions.map((action) => (
                      <div key={action} className="rounded-xl border border-border/60 bg-background/45 px-3 py-2 text-sm text-foreground">
                        {action}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border/60 bg-card/55 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Clapperboard className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Retention Prediction Graph</h2>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/55 p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{predictionValue}% predicted</span>
                  <span>Goal line: {goalValue}%+</span>
                </div>
                <div className="relative h-4 rounded-full bg-muted/80">
                  <div className="h-full rounded-full bg-primary/85 transition-all duration-700" style={{ width: `${predictionValue}%` }} />
                  <div className="absolute inset-y-[-4px] w-[2px] bg-warning shadow-[0_0_10px_hsl(var(--warning)/0.85)]" style={{ left: `${goalValue}%` }} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Tune with A-Mode suggestions</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-success/35 bg-success/10 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-lg font-semibold text-foreground">Export is ready.</p>
                <p className="text-sm text-muted-foreground">Download your final cut.</p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <OpenEditorCTA label="Download Final Cut" />
                <Link to="/editor" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full rounded-full border-border/60 px-8 text-foreground hover:bg-background/70 sm:w-auto"
                  >
                    Open Editor
                  </Button>
                </Link>
              </div>
            </div>
          </motion.section>
        </div>
      </main>
    </GlowBackdrop>
  );
};

export default Index;
