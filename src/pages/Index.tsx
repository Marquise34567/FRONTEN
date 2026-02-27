import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Gauge,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
} from "lucide-react";
import { Link } from "react-router-dom";

import LandingDemoVideo from "@/components/landing/LandingDemoVideo";
import PurpleAccentButton from "@/components/premium/PurpleAccentButton";
import ThemeSwitcher from "@/components/premium/ThemeSwitcher";
import { cn } from "@/lib/utils";

const revealTransition = { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const };

const featureCards = [
  {
    title: "Hook Intelligence",
    detail: "Detects strongest 3-5s openers, predicts drop risk, and prioritizes opener moments with measurable retention upside.",
    icon: BrainCircuit,
    signal: "92% Hook Confidence",
  },
  {
    title: "Adaptive Pacing",
    detail: "Applies micro-hooks, dynamic cut cadence, and selective punch-ins to remove passive moments before they cost watch-time.",
    icon: Gauge,
    signal: "Auto-cuts Low-Energy Zones",
  },
  {
    title: "Explainable Analytics",
    detail: "Every edit includes a reason trail, before/after deltas, and confidence scoring so your team can iterate with clarity.",
    icon: BarChart3,
    signal: "Before 48% -> After 82%",
  },
];

const testimonials = [
  {
    quote: "Our Shorts retention jumped from 46% to 74% in two weeks.",
    name: "Lena Park",
    role: "Creator Studio Lead",
    avatar: "LP",
  },
  {
    quote: "Hook explanations helped us train junior editors in under a week.",
    name: "Mika Tran",
    role: "Growth Team Manager",
    avatar: "MT",
  },
  {
    quote: "The deep-dive graph is now part of every post-mortem.",
    name: "Ravi Patel",
    role: "Agency Lead",
    avatar: "RP",
  },
];

const partners = ["Creator Labs", "Studio Neon", "Signal Media", "GrowthOps Collective", "FrameNorth", "ClipWave"];
const socialMetrics = [
  { value: "+68%", label: "avg retention lift", icon: TrendingUp },
  { value: "12k+", label: "creators using AutoEditor", icon: Users },
  { value: "4.9/5", label: "editor satisfaction", icon: Sparkles },
];

type FeatureCardProps = (typeof featureCards)[number] & { index: number };

function FeatureCard({ title, detail, icon: Icon, signal, index }: FeatureCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 26, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...revealTransition, delay: index * 0.08 }}
      viewport={{ once: true, amount: 0.25 }}
      whileHover={{ y: -6, scale: 1.01 }}
      className="group relative overflow-hidden rounded-[1.7rem] border border-white/12 bg-[color:color-mix(in_srgb,var(--ae-surface)_84%,black_24%)] p-6 backdrop-blur-xl"
      style={{ filter: "drop-shadow(0 0 12px rgba(192,132,252,0.25))" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_70%_at_12%_0%,rgba(192,132,252,0.2),transparent_66%),radial-gradient(60%_60%_at_90%_0%,rgba(217,70,239,0.16),transparent_68%)] opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative z-10">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-purple-200/35 bg-purple-500/20 text-purple-100">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--ae-text-primary)]">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-[color:color-mix(in_srgb,var(--ae-text-secondary)_86%,white_14%)]">{detail}</p>
        <div className="mt-5 inline-flex rounded-full border border-purple-200/35 bg-black/35 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.13em] text-purple-100">
          {signal}
        </div>
      </div>
    </motion.article>
  );
}

type TestimonialCardProps = (typeof testimonials)[number] & { index: number };

function TestimonialCard({ quote, name, role, avatar, index }: TestimonialCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ ...revealTransition, delay: index * 0.08 }}
      viewport={{ once: true, amount: 0.2 }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-3xl border border-white/12 bg-[color:color-mix(in_srgb,var(--ae-surface)_78%,black_30%)] p-5 backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="h-full w-full bg-[radial-gradient(84%_76%_at_50%_0%,rgba(192,132,252,0.2),transparent_70%)]" />
      </div>
      <div className="relative z-10">
        <p className="text-sm leading-relaxed text-[var(--ae-text-primary)]">"{quote}"</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-purple-200/45 bg-gradient-to-br from-[#c084fc] to-[#a855f7] text-xs font-semibold text-white">
            {avatar}
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--ae-text-primary)]">{name}</p>
            <p className="text-xs text-[var(--ae-text-secondary)]">{role}</p>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export default function Index() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -70]);
  const heroGlow = useTransform(scrollYProgress, [0, 0.4], [0.95, 0.5]);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[var(--ae-bg)] text-[var(--ae-text-primary)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_12%_0%,rgba(192,132,252,0.2),transparent_65%),radial-gradient(54%_45%_at_84%_8%,rgba(217,70,239,0.18),transparent_72%),linear-gradient(180deg,rgba(2,3,8,0.94)_0%,rgba(2,3,8,1)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.05)_0%,transparent_28%,transparent_72%,rgba(255,255,255,0.05)_100%)]" />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[color:color-mix(in_srgb,var(--ae-shell)_82%,black_40%)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-[var(--ae-text-primary)]">
            <span>AutoEditor</span>
            <span className="inline-flex items-center rounded-full border border-purple-200/30 bg-purple-500/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-purple-100">
              2026
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <ThemeSwitcher />
            </div>
            <Link
              to="/pricing"
              className="hidden rounded-xl border border-white/15 bg-black/35 px-3.5 py-2 text-sm text-[var(--ae-text-primary)] transition hover:border-purple-200/45 md:inline-flex"
            >
              View Pricing
            </Link>
            <PurpleAccentButton asChild size="sm" icon={<Wand2 className="h-4 w-4" />}>
              <Link to="/editor">Open Editor →</Link>
            </PurpleAccentButton>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-[1240px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[2.2rem] border border-white/12 bg-[color:color-mix(in_srgb,var(--ae-surface)_80%,black_30%)] p-5 backdrop-blur-xl md:p-7"
        >
          <motion.div
            className="pointer-events-none absolute -left-24 -top-36 h-80 w-80 rounded-full bg-purple-500/26 blur-[130px]"
            style={{ opacity: heroGlow }}
          />
          <motion.div className="pointer-events-none absolute -right-12 top-10 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-[120px]" style={{ y: heroY }} />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_1.05fr]">
            <motion.div style={{ y: heroY }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-purple-200/35 bg-purple-500/12 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-purple-100">
                <Sparkles className="h-3.5 w-3.5" />
                Retention Intelligence Platform
              </span>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.03] tracking-tight text-[var(--ae-text-primary)] sm:text-5xl lg:text-6xl">
                AutoEditor, built to maximize viewer retention on every cut
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--ae-text-secondary)] sm:text-lg">
                Upload once, then AutoEditor finds hooks, predicts drop-offs, and generates high-retention edits for Shorts, Reels, and YouTube.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <PurpleAccentButton asChild size="lg" icon={<Wand2 className="h-4 w-4" />}>
                  <Link to="/editor">
                    Open Editor →
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </PurpleAccentButton>
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-black/30 px-5 py-3 text-sm font-medium text-[var(--ae-text-primary)] transition hover:border-purple-200/45 hover:bg-black/45"
                >
                  View Pricing
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-200">
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">Start Free - No Credit Card</span>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">See Retention Jump in Minutes</span>
              </div>
            </motion.div>

            <LandingDemoVideo />
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={revealTransition}
          viewport={{ once: true, amount: 0.2 }}
          className="mt-10 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]"
        >
          <div className="space-y-4 rounded-[1.8rem] border border-white/12 bg-[color:color-mix(in_srgb,var(--ae-surface)_82%,black_25%)] p-6 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.18em] text-purple-200">Trusted by</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-[var(--ae-text-primary)] sm:grid-cols-3">
              {partners.map((partner) => (
                <div key={partner} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-center">
                  {partner}
                </div>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {socialMetrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <motion.div
                    key={metric.label}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ ...revealTransition, delay: index * 0.08 }}
                    viewport={{ once: true, amount: 0.3 }}
                    className="rounded-2xl border border-purple-200/20 bg-black/35 px-4 py-3"
                  >
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-purple-200/30 bg-purple-500/12 text-purple-100">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="mt-2 text-xl font-semibold tracking-tight text-[var(--ae-text-primary)]">{metric.value}</p>
                    <p className="text-xs text-[var(--ae-text-secondary)]">{metric.label}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {testimonials.map((item, index) => (
              <TestimonialCard key={item.name} {...item} index={index} />
            ))}
          </div>
        </motion.section>

        <section className="mt-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={revealTransition}
            viewport={{ once: true, amount: 0.25 }}
            className="max-w-3xl"
          >
            <p className="text-sm uppercase tracking-[0.2em] text-purple-200">Core capabilities</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ae-text-primary)] sm:text-4xl">
              Precision AI editing built for retention-first creators
            </h2>
          </motion.div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {featureCards.map((feature, index) => (
              <FeatureCard key={feature.title} {...feature} index={index} />
            ))}
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={revealTransition}
          viewport={{ once: true, amount: 0.25 }}
          className={cn(
            "mt-14 rounded-[1.9rem] border border-purple-200/30 bg-[linear-gradient(120deg,rgba(17,11,29,0.95),rgba(8,10,18,0.92))] p-7 backdrop-blur-xl",
            "shadow-[0_0_42px_-16px_rgba(192,132,252,0.42)]",
          )}
        >
          <p className="text-sm uppercase tracking-[0.18em] text-purple-200">Conversion Accelerator</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">See retention gains before your next publish</h3>
          <p className="mt-3 max-w-2xl text-sm text-slate-200 sm:text-base">
            AutoEditor continuously compares predicted vs final retention so every new cut learns from the last one.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <PurpleAccentButton asChild size="lg" icon={<Wand2 className="h-4 w-4" />}>
              <Link to="/editor">Open Editor →</Link>
            </PurpleAccentButton>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center rounded-2xl border border-purple-100/40 bg-transparent px-5 py-3 text-sm font-medium text-purple-100 transition hover:bg-purple-400/10"
            >
              View Pricing
            </Link>
          </div>
        </motion.section>
      </main>
      <footer className="relative mx-auto w-full max-w-[1240px] px-4 pb-8 pt-8 text-sm sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-[color:color-mix(in_srgb,var(--ae-surface)_78%,black_30%)] p-5 backdrop-blur-xl sm:flex-row sm:items-center">
          <p className="text-[var(--ae-text-secondary)]">© 2026 AutoEditor</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/pricing" className="text-[var(--ae-text-secondary)] transition hover:text-[var(--ae-text-primary)]">
              Pricing
            </Link>
            <Link to="/signup" className="text-[var(--ae-text-secondary)] transition hover:text-[var(--ae-text-primary)]">
              Start Free
            </Link>
            <a href="https://x.com" target="_blank" rel="noreferrer" className="text-[var(--ae-text-secondary)] transition hover:text-[var(--ae-text-primary)]">
              X
            </a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="text-[var(--ae-text-secondary)] transition hover:text-[var(--ae-text-primary)]">
              Instagram
            </a>
            <a href="#" className="text-[var(--ae-text-secondary)] transition hover:text-[var(--ae-text-primary)]">
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

