import { motion } from "framer-motion";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Progress } from "@/components/ui/progress";
import PricingCards from "@/components/PricingCards";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Gauge, ScissorsSquare, Sparkles, Upload } from "lucide-react";

const demoSteps = [
  {
    title: "Upload footage",
    detail: "Drag your raw recording into the editor.",
    cue: "Raw clip imported",
    progress: 18,
    icon: Upload,
  },
  {
    title: "Choose format",
    detail: "Switch to vertical or landscape output instantly.",
    cue: "9:16 vertical preset selected",
    progress: 42,
    icon: Gauge,
  },
  {
    title: "Run AI auto-cut",
    detail: "It removes dead air and weak retention moments.",
    cue: "12 low-retention segments removed",
    progress: 74,
    icon: ScissorsSquare,
  },
  {
    title: "Export final",
    detail: "Render and publish-ready captions are generated.",
    cue: "Final cut ready to publish",
    progress: 100,
    icon: CheckCircle2,
  },
] as const;

const Index = () => {
  const [activeDemoStep, setActiveDemoStep] = useState(0);

  const proofCards = [
    {
      icon: Sparkles,
      title: "Hook-first AI edits",
      stat: "3x faster rough cuts",
      detail: "Auto-detects dead air and keeps openings high-retention.",
    },
    {
      icon: ScissorsSquare,
      title: "Creator-grade templates",
      stat: "1-click style packs",
      detail: "Apply pacing, captions, and framing tuned for short-form feeds.",
    },
    {
      icon: Gauge,
      title: "Scale with your plan",
      stat: "From free to studio",
      detail: "Upgrade as your publishing frequency and rendering volume increase.",
    },
  ];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveDemoStep((current) => (current + 1) % demoSteps.length);
    }, 2200);

    return () => window.clearInterval(interval);
  }, []);

  const activeDemo = demoSteps[activeDemoStep];

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main relative min-h-screen overflow-hidden px-4 pt-24 pb-24">
        <div className="landing-royal-tv-bg" aria-hidden="true">
          <div className="landing-royal-tv-scene">
            <div className="landing-retro-tv">
              <span className="landing-retro-tv-antenna landing-retro-tv-antenna-left" />
              <span className="landing-retro-tv-antenna landing-retro-tv-antenna-right" />
              <div className="landing-retro-tv-screen">
                <div className="landing-retro-tv-static" />
              </div>
              <div className="landing-retro-tv-speaker">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="landing-retro-tv-knobs">
                <span />
                <span />
              </div>
            </div>

            <div className="landing-retro-tv-stand" />
          </div>
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center">
          {/* Hero */}
          <motion.div
            className="mx-auto flex w-full max-w-3xl flex-col items-center text-center"
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
              PREMIUM AI AUTO-EDITOR
            </motion.div>

            <motion.h1
              className="mb-6 text-4xl font-bold font-display leading-[1.1] tracking-tight text-foreground sm:text-6xl lg:text-7xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
            >
              Retention Is{" "}
              <span className="landing-king-word">
                <span className="landing-royal-crown landing-royal-crown-inline" aria-hidden="true">
                  <span className="landing-royal-crown-spike landing-royal-crown-spike-left" />
                  <span className="landing-royal-crown-spike landing-royal-crown-spike-mid" />
                  <span className="landing-royal-crown-spike landing-royal-crown-spike-right" />
                  <span className="landing-royal-crown-gem" />
                </span>
                King
              </span>{" "}
              — We Built the Tools to Rule It
            </motion.h1>

            <motion.p
              className="mb-10 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              Upload your raw footage and let AI detect hooks, cut boring parts, match pacing to your niche, and render a polished final cut automatically.
            </motion.p>

            <motion.div
              className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:gap-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.6 }}
            >
              <Link to="/editor" className="w-full sm:w-auto">
                <Button size="lg" className="w-full gap-2 rounded-full bg-primary px-8 text-primary-foreground glow-sm hover:bg-primary/90 sm:w-auto">
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/pricing" className="w-full sm:w-auto">
                <Button variant="ghost" size="lg" className="w-full rounded-full px-8 text-muted-foreground hover:text-foreground sm:w-auto">
                  View Pricing
                </Button>
              </Link>
              <Link to="/editor?mode=vertical" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full gap-2 rounded-full border-border/60 px-8 sm:w-auto">
                  <ScissorsSquare className="w-4 h-4" />
                  Vertical Mode
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Demo Card */}
          <motion.div
            className="mt-20 w-full max-w-4xl"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
          >
            <div className="glass-card p-6 sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-display font-semibold text-foreground">How It Works</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs text-muted-foreground">Live walkthrough</span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-2">
                  {demoSteps.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = index === activeDemoStep;
                    const isCompleted = index < activeDemoStep;

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
                    <span>Editor timeline</span>
                    <span>{activeDemo.progress}%</span>
                  </div>

                  <div className="relative mb-3 h-20 overflow-hidden rounded-lg border border-border/50 bg-background/80 p-3">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/8 transition-all duration-700 ease-out"
                      style={{ width: `${activeDemo.progress}%` }}
                    />
                    <div className="relative grid h-full grid-cols-12 gap-1">
                      {Array.from({ length: 12 }).map((_, index) => {
                        const threshold = Math.round((activeDemo.progress / 100) * 12);
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
                      animate={{ left: `calc(${Math.min(activeDemo.progress, 98)}% - 1px)` }}
                      transition={{ duration: 0.7, ease: "easeInOut" }}
                    />
                  </div>

                  <Progress value={activeDemo.progress} className="h-2 bg-muted [&>div]:bg-primary" />
                  <motion.p
                    key={activeDemo.cue}
                    className="mt-3 text-xs text-muted-foreground"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {activeDemo.cue}
                  </motion.p>
                </div>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                This loop mirrors the same flow inside the editor, from raw upload to export.
              </p>
            </div>
          </motion.div>

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
                SUBSCRIPTION PLANS
              </div>
              <h2 className="text-3xl font-bold font-display text-foreground sm:text-4xl">
                Pricing That Grows With Your Output
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                Start free, then move to higher quality, higher volume, and priority queue access as your channel scales.
              </p>
            </motion.div>

            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {proofCards.map((item, index) => (
                <motion.div
                  key={item.title}
                  className="glass-card-hover p-4"
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ delay: index * 0.08, duration: 0.45 }}
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

            <motion.div
              className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.45 }}
            >
              <Link to="/pricing" className="w-full sm:w-auto">
                <Button variant="ghost" size="lg" className="w-full rounded-full px-8 text-muted-foreground hover:text-foreground sm:w-auto">
                  Compare Full Plans
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
        </div>
      </main>
    </GlowBackdrop>
  );
};

export default Index;
