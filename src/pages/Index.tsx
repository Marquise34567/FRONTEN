import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Gauge, ScissorsSquare, Sparkles, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const PricingCards = lazy(() => import("@/components/PricingCards"));

const ENTRY_EASE = [0.25, 0.1, 0.25, 1] as const;
const UI_EASE = [0.4, 0, 0.2, 1] as const;
const DEMO_STEP_MS_DESKTOP = 2200;
const DEMO_STEP_MS_MOBILE = 2800;
const CARD_STAGGER = 0.08;

const useIsMobileViewport = () => {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
};

const demoSteps = [
  {
    title: "Upload footage",
    detail: "Drop in long-form recordings, livestream archives, or podcasts.",
    cue: "Raw source indexed",
    progress: 18,
    icon: Upload,
  },
  {
    title: "Set format profile",
    detail: "Switch between 9:16, 1:1, and 16:9 while preserving style presets.",
    cue: "Multi-format preset synced",
    progress: 42,
    icon: Gauge,
  },
  {
    title: "Run retention pass",
    detail: "AI trims dead air and weak beats around your strongest hooks.",
    cue: "12 low-retention segments removed",
    progress: 74,
    icon: ScissorsSquare,
  },
  {
    title: "Ship final cut",
    detail: "Render with captions and push a publish-ready master.",
    cue: "Export package ready",
    progress: 100,
    icon: CheckCircle2,
  },
] as const;

const studioSignals = [
  { label: "Formats", value: "9:16 + 16:9" },
  { label: "Workflow", value: "Auto-cut + captions" },
  { label: "Output", value: "Creator to studio" },
] as const;

const featureCards = [
  {
    icon: Sparkles,
    title: "Hook-aware first pass",
    stat: "Retention-focused edits",
    detail: "AI ranks scenes by audience pull so the opener lands harder without manual trimming.",
  },
  {
    icon: ScissorsSquare,
    title: "Template-driven polish",
    stat: "Reusable finishing packs",
    detail: "Apply consistent pacing, subtitles, framing, and cadence across every output ratio.",
  },
  {
    icon: Gauge,
    title: "Built for publishing volume",
    stat: "Scale with your output",
    detail: "Move from free to higher-throughput plans as your team and release cadence grow.",
  },
] as const;

const channelBadges = ["YouTube Shorts", "Instagram Reels", "TikTok", "Podcast Clips"] as const;

const Index = () => {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobileViewport();
  const [activeDemoStep, setActiveDemoStep] = useState(0);
  const [isDemoInView, setIsDemoInView] = useState(false);
  const [shouldLoadPricingCards, setShouldLoadPricingCards] = useState(false);
  const demoSectionRef = useRef<HTMLDivElement | null>(null);
  const pricingSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = demoSectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsDemoInView(entry.isIntersecting),
      { rootMargin: "180px 0px", threshold: 0.12 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = pricingSectionRef.current;
    if (!node || shouldLoadPricingCards) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoadPricingCards(true);
        observer.disconnect();
      },
      { rootMargin: "220px 0px", threshold: 0.04 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLoadPricingCards]);

  useEffect(() => {
    if (prefersReducedMotion || !isDemoInView) {
      setActiveDemoStep(0);
      return;
    }

    let frameId = 0;
    let lastTimestamp = 0;
    let elapsed = 0;
    const stepDuration = isMobile ? DEMO_STEP_MS_MOBILE : DEMO_STEP_MS_DESKTOP;

    const loop = (timestamp: number) => {
      if (lastTimestamp === 0) {
        lastTimestamp = timestamp;
      }

      if (!document.hidden) {
        elapsed += timestamp - lastTimestamp;
        if (elapsed >= stepDuration) {
          const advanceBy = Math.floor(elapsed / stepDuration);
          elapsed -= advanceBy * stepDuration;
          setActiveDemoStep((current) => (current + advanceBy) % demoSteps.length);
        }
      }

      lastTimestamp = timestamp;
      frameId = window.requestAnimationFrame(loop);
    };

    frameId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameId);
  }, [isDemoInView, isMobile, prefersReducedMotion]);

  const activeDemo = demoSteps[activeDemoStep];
  const timelineSegments = isMobile ? 8 : 12;
  const progressScale = activeDemo.progress / 100;

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main min-h-screen px-4 pb-24 pt-24 sm:pt-28">
        <div className="mx-auto flex w-full max-w-6xl flex-col">
          <motion.section
            className="landing-premium-hero w-full overflow-hidden rounded-[2rem] border border-border/50 px-5 py-8 sm:px-8 sm:py-10 lg:px-11 lg:py-12"
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: ENTRY_EASE }}
          >
            <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
              <div className="relative z-10">
                <motion.div
                  className="pill-badge mb-6"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15, duration: 0.4, ease: UI_EASE }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  CREATOR WORKFLOW ENGINE
                </motion.div>

                <motion.h1
                  className="max-w-2xl text-4xl font-bold font-display leading-[1.03] tracking-tight text-foreground sm:text-6xl lg:text-7xl"
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.24, duration: 0.54, ease: ENTRY_EASE }}
                >
                  The Premium Edit Suite for{" "}
                  <span className="bg-[linear-gradient(122deg,#C7F6FF_0%,#7ED8FF_40%,#F9D89D_82%,#FFD2A3_100%)] bg-clip-text text-transparent">
                    Fast, Sharp, Publish-Ready Cuts.
                  </span>
                </motion.h1>

                <motion.p
                  className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.32, duration: 0.45, ease: ENTRY_EASE }}
                >
                  Upload raw footage and let AI shape the first pass, tighten pacing, style captions, and deliver final exports tuned for every channel.
                </motion.p>

                <motion.div
                  className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap"
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.42, ease: ENTRY_EASE }}
                >
                  <Link to="/editor" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full gap-2 rounded-full bg-primary px-8 text-primary-foreground shadow-[0_16px_44px_-24px_hsl(var(--primary)/0.95)] hover:bg-primary/90 sm:w-auto">
                      Start Editing Free
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/pricing" className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full rounded-full border-[#8fdff9]/30 bg-[#0f1827]/40 px-8 text-[#d2f4ff] hover:bg-[#132038]/60 sm:w-auto"
                    >
                      View Plans
                    </Button>
                  </Link>
                  <Link to="/editor?mode=vertical" className="w-full sm:w-auto">
                    <Button variant="ghost" size="lg" className="w-full gap-2 rounded-full px-8 text-muted-foreground hover:text-foreground sm:w-auto">
                      <ScissorsSquare className="h-4 w-4" />
                      Vertical Preset
                    </Button>
                  </Link>
                </motion.div>

                <motion.div
                  className="mt-8 flex flex-wrap gap-2"
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.48, duration: 0.4, ease: ENTRY_EASE }}
                >
                  {channelBadges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-[#7ad8f8]/20 bg-[#101b2a]/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a8d7e8]"
                    >
                      {badge}
                    </span>
                  ))}
                </motion.div>

                <motion.div
                  className="mt-7 grid gap-2 sm:grid-cols-3"
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.56, duration: 0.45, ease: ENTRY_EASE }}
                >
                  {studioSignals.map((signal) => (
                    <div key={signal.label} className="landing-signal-tile rounded-xl px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-[#9ac9d9]">{signal.label}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{signal.value}</p>
                    </div>
                  ))}
                </motion.div>
              </div>

              <motion.div
                ref={demoSectionRef}
                className="relative z-10"
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.36, duration: 0.5, ease: ENTRY_EASE }}
              >
                <div className="landing-premium-panel rounded-2xl p-5 sm:p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#1f2b3f]/70">
                        <Sparkles className="h-4 w-4 text-[#9be6ff]" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Live AI Workflow</p>
                        <p className="text-xs text-muted-foreground">Real-time timeline simulation</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#9ad6bb]">
                      <span className="h-2 w-2 rounded-full bg-[#49dd95] animate-pulse" />
                      Active
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#6ccbf5]/20 bg-[#0e1625]/70 p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{activeDemo.title}</p>
                        <motion.p
                          key={activeDemo.cue}
                          className="mt-1 text-xs text-[#9bc4d5]"
                          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.28, ease: ENTRY_EASE }}
                        >
                          {activeDemo.cue}
                        </motion.p>
                      </div>
                      <span className="text-xs text-[#bee6f4]">{activeDemo.progress}%</span>
                    </div>

                    <div className="relative mb-3 h-16 overflow-hidden rounded-lg border border-[#7ecfef]/20 bg-[#11192b]/80 p-2.5">
                      <motion.div
                        className="absolute inset-y-0 left-0 origin-left bg-[#4da6ff]/15"
                        animate={{ scaleX: progressScale }}
                        transition={{ duration: 0.44, ease: UI_EASE }}
                      />

                      <div className="relative grid h-full gap-1" style={{ gridTemplateColumns: `repeat(${timelineSegments}, minmax(0, 1fr))` }}>
                        {Array.from({ length: timelineSegments }).map((_, index) => {
                          const threshold = Math.round((activeDemo.progress / 100) * timelineSegments);
                          const isFilled = index < threshold;
                          return (
                            <motion.div
                              key={`timeline-${index}`}
                              className={cn("rounded-[5px]", isFilled ? "bg-[#82d7ff]" : "bg-[#20283a]")}
                              animate={{ opacity: isFilled ? 0.95 : 0.55 }}
                              transition={{ duration: 0.28, delay: isMobile ? 0 : index * 0.016 }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-[#20283a] [contain:paint]">
                      <motion.div
                        className="h-full origin-left bg-[linear-gradient(90deg,#54c7ff,#8ce4ff)] transform-gpu [backface-visibility:hidden] will-change-transform"
                        animate={{ scaleX: progressScale }}
                        transition={{ duration: 0.38, ease: UI_EASE }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {demoSteps.map((step, index) => {
                      const Icon = step.icon;
                      const isActive = index === activeDemoStep;
                      const isCompleted = index < activeDemoStep;

                      return (
                        <motion.div
                          key={step.title}
                          className={cn(
                            "rounded-xl border px-3 py-2.5",
                            isActive ? "border-[#7fdaf8]/40 bg-[#152235]/60" : "border-border/45 bg-card/25",
                          )}
                          animate={{ opacity: isActive ? 1 : 0.84, scale: isActive ? 1 : 0.988 }}
                          transition={{ duration: 0.3, ease: UI_EASE }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background/75 text-xs font-semibold text-muted-foreground">
                              {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : index + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Icon className={isActive ? "h-3.5 w-3.5 text-[#9be4ff]" : "h-3.5 w-3.5 text-muted-foreground"} />
                                <p className={isActive ? "text-sm font-medium text-foreground" : "text-sm font-medium text-muted-foreground"}>
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
                </div>
              </motion.div>
            </div>
          </motion.section>

          <motion.section
            className="mt-14 grid gap-4 md:grid-cols-3"
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.48, ease: ENTRY_EASE }}
          >
            {featureCards.map((card, index) => (
              <motion.div
                key={card.title}
                className="landing-premium-panel rounded-2xl p-5"
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ delay: index * CARD_STAGGER, duration: 0.42, ease: ENTRY_EASE }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#152032]/80">
                    <card.icon className="h-4 w-4 text-[#91deff]" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">{card.title}</p>
                </div>
                <p className="text-sm font-medium text-[#c7e9f5]">{card.stat}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{card.detail}</p>
              </motion.div>
            ))}
          </motion.section>

          <motion.section
            ref={pricingSectionRef}
            className="mt-20 w-full"
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.52, ease: ENTRY_EASE }}
          >
            <div className="landing-premium-panel rounded-[1.8rem] p-6 sm:p-8">
              <motion.div
                className="mx-auto mb-8 max-w-3xl text-center"
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.44, ease: ENTRY_EASE }}
              >
                <div className="pill-badge mb-4">
                  <Sparkles className="h-3.5 w-3.5" />
                  SUBSCRIPTION TIERS
                </div>
                <h2 className="text-3xl font-bold font-display text-foreground sm:text-4xl">
                  Premium Plans for Every Publishing Stage
                </h2>
                <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                  Start with core tools, then unlock higher throughput and priority rendering as your output grows.
                </p>
              </motion.div>

              {shouldLoadPricingCards ? (
                <Suspense
                  fallback={
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={`pricing-skeleton-${index}`}
                          className="h-72 rounded-2xl border border-border/60 bg-card/40"
                        />
                      ))}
                    </div>
                  }
                >
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
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={`pricing-shell-${index}`} className="h-72 rounded-2xl border border-border/60 bg-card/40" />
                  ))}
                </div>
              )}

              <motion.div
                className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.4, ease: ENTRY_EASE }}
              >
                <Link to="/pricing" className="w-full sm:w-auto">
                  <Button variant="ghost" size="lg" className="w-full rounded-full px-8 text-muted-foreground hover:text-foreground sm:w-auto">
                    Compare Full Plans
                  </Button>
                </Link>
                <Link to="/signup" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full gap-2 rounded-full bg-primary px-8 text-primary-foreground hover:bg-primary/90 sm:w-auto">
                    Start Free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>
            </div>
          </motion.section>
        </div>
      </main>
    </GlowBackdrop>
  );
};

export default Index;
