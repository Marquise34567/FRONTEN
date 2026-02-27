import { motion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  Captions,
  CheckCircle2,
  Gauge,
  Sparkles,
  Upload,
  Volume2,
  Waves,
} from "lucide-react";
import { Link } from "react-router-dom";

import LandingDemoVideo from "@/components/landing/LandingDemoVideo";
import GoldAccentButton from "@/components/premium/GoldAccentButton";

const keyMetrics = [
  { label: "Hook Win Rate", value: "+31%" },
  { label: "Edit Throughput", value: "4.3x" },
  { label: "Revision Cycles", value: "-52%" },
];

const workflowSignals = [
  {
    title: "Retention Scan",
    detail: "Frame-level drop risk mapping with AI hook confidence overlays.",
    icon: Waves,
  },
  {
    title: "Pacing Engine",
    detail: "Auto cadence shaping to remove passive segments before they hurt watch-time.",
    icon: Gauge,
  },
  {
    title: "Caption Intelligence",
    detail: "Keyword-highlighted animated captions tuned for short-form retention.",
    icon: Captions,
  },
  {
    title: "Studio Audio",
    detail: "Voice cleanup, leveling, and enhancement with one-click presets.",
    icon: Volume2,
  },
];

const testimonials = [
  {
    quote: "We now ship three times faster and retention lifts are visible in every export.",
    source: "Creator Team, Viral Shorts Network",
  },
  {
    quote: "The hook scanner catches weak intros before we publish.",
    source: "Solo Creator, 2.4M followers",
  },
  {
    quote: "Our team finally edits with one retention language across TikTok, Reels, and Shorts.",
    source: "Studio Lead, ClipScale",
  },
];

export default function Index() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-[var(--ae-bg)] text-[var(--ae-text-primary)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_8%_0%,rgba(52,240,208,0.18),transparent_68%),radial-gradient(55%_45%_at_88%_10%,rgba(180,119,255,0.2),transparent_72%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.03)_0%,transparent_24%,transparent_76%,rgba(255,255,255,0.03)_100%)]" />

      <header className="sticky top-0 z-40 border-b border-cyan-200/10 bg-[color:color-mix(in_srgb,var(--ae-shell)_84%,black_36%)] backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <span>AutoEditor</span>
            <span className="rounded-full border border-cyan-200/30 bg-cyan-400/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-cyan-100">
              BETA
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/pricing"
              className="hidden rounded-2xl border border-cyan-200/20 bg-white/[0.02] px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-200/40 md:inline-flex"
            >
              Pricing
            </Link>
            <GoldAccentButton asChild size="sm">
              <Link to="/signup">Start Free</Link>
            </GoldAccentButton>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-[1240px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <section className="landing-premium-hero rounded-[2rem] border border-cyan-200/20 px-5 py-10 md:px-8 md:py-12">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-4xl text-center"
          >
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-400/10 px-4 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Retention-First Editing
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              AI Editor Built To Keep People Watching
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              1 Upload -&gt; High-Retention Clips with Perfect Hooks. Tune pacing, captions, reframing, and audio in one
              automation-first workspace.
            </p>

            <div className="landing-premium-panel mx-auto mt-8 max-w-3xl rounded-[1.6rem] p-5">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="rounded-2xl border border-cyan-200/20 bg-black/35 px-4 py-3 text-left">
                  <p className="text-xs uppercase tracking-[0.16em] text-cyan-100">Upload footage or paste link</p>
                  <p className="mt-1 text-sm text-slate-300">Drag MP4 / MOV or drop a YouTube URL to run retention scan.</p>
                </div>
                <GoldAccentButton className="w-full sm:w-auto" icon={<Upload className="h-4 w-4" />}>
                  Try BETA
                </GoldAccentButton>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {keyMetrics.map((metric) => (
                  <div key={metric.label} className="landing-signal-tile rounded-xl px-3 py-2 text-left">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
                    <p className="mt-1 text-lg font-semibold text-cyan-100">{metric.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        <section className="mt-10 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="landing-premium-panel rounded-[1.6rem] p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-white">Live Retention Scan Demo</h2>
              <span className="rounded-full border border-cyan-200/30 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-cyan-100">
                Hook Win Rate +31%
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Keep People Watching with AI decisions explained in real-time. Watch hook candidates, waveform pacing,
              and retention hotspots update live.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {workflowSignals.map((signal) => (
                <div key={signal.title} className="rounded-2xl border border-cyan-200/14 bg-black/35 px-3 py-3">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-100">
                    <signal.icon className="h-4 w-4" />
                    {signal.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{signal.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <LandingDemoVideo />
        </section>

        <section className="mt-10 grid gap-3 md:grid-cols-3">
          {testimonials.map((item) => (
            <article key={item.source} className="landing-premium-panel rounded-3xl p-5">
              <p className="text-sm text-slate-100">"{item.quote}"</p>
              <p className="mt-3 inline-flex items-center gap-2 text-xs text-cyan-100">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {item.source}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-[1.8rem] border border-cyan-200/20 bg-[linear-gradient(130deg,rgba(8,16,24,0.92),rgba(14,12,29,0.86))] p-7 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-cyan-100">
            <BrainCircuit className="h-3.5 w-3.5" />
            Used by creators for viral shorts
          </p>
          <h3 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Keep People Watching, Automatically</h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-300">
            Build high-retention clips faster with one-click AI editing for hooks, pacing, captions, and studio-quality
            audio enhancement.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <GoldAccentButton asChild size="lg" icon={<ArrowRight className="h-4 w-4" />}>
              <Link to="/editor">Open Retention Studio</Link>
            </GoldAccentButton>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center rounded-2xl border border-cyan-200/30 bg-white/[0.02] px-5 py-3 text-sm text-slate-100 transition hover:border-cyan-200/55"
            >
              View Plans
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
