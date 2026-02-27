import { motion } from "framer-motion";
import { ArrowRight, ChartNoAxesColumn, Clapperboard, Sparkles, Wand2, Workflow } from "lucide-react";
import { Link } from "react-router-dom";

import AppShell from "@/components/premium/AppShell";
import PremiumCard from "@/components/premium/PremiumCard";
import PurpleAccentButton from "@/components/premium/PurpleAccentButton";

const signalCards = [
  {
    title: "Hook Win Rate",
    value: "+31%",
    detail: "3-5s intros rewritten with retention-risk signals.",
  },
  {
    title: "Edit Throughput",
    value: "4.3x",
    detail: "Single upload to multi-platform export flow.",
  },
  {
    title: "Revision Cycles",
    value: "-52%",
    detail: "Fewer guess-and-check loops before publish.",
  },
];

const featureCards = [
  {
    title: "Adaptive Pipeline",
    description: "Vertical and horizontal versions are tuned separately, not stretched from one timeline.",
    icon: Workflow,
  },
  {
    title: "Retention Graphing",
    description: "See drop zones and retention peaks, then apply correction steps in-editor.",
    icon: ChartNoAxesColumn,
  },
  {
    title: "Creator Deliverables",
    description: "Exports, thumbnails, and retention notes are packaged for immediate publishing.",
    icon: Clapperboard,
  },
];

export default function Index() {
  return (
    <AppShell title="AutoEditor">
      <div className="space-y-4">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]"
        >
          <PremiumCard className="relative overflow-hidden border border-cyan-300/20 bg-[radial-gradient(115%_120%_at_0%_0%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(80%_100%_at_100%_0%,rgba(217,70,239,0.18),transparent_62%),linear-gradient(180deg,rgba(8,16,30,0.95),rgba(6,11,20,0.96))] p-7 md:p-8">
            <motion.div
              className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl"
              animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.55, 0.3] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="max-w-3xl space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/35 bg-cyan-500/12 px-3 py-1 text-xs uppercase tracking-[0.14em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                Retention-first editing
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-100 md:text-6xl">
                AI Editor Built To <span className="text-cyan-300">Keep People Watching</span>
              </h1>
              <p className="max-w-2xl text-base text-slate-300 md:text-lg">
                Upload footage, run the retention pipeline, and export platform-ready cuts with hook, pacing, and caption
                decisions surfaced in one workflow.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <PurpleAccentButton asChild size="lg" icon={<Wand2 className="h-4 w-4" />}>
                  <Link to="/editor">
                    Open Editor
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </PurpleAccentButton>
                <Link
                  to="/pricing"
                  className="inline-flex items-center rounded-2xl border border-white/15 bg-black/35 px-5 py-3 text-sm text-slate-100 hover:border-cyan-200/35"
                >
                  View Pricing
                </Link>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-5 py-3 text-sm text-cyan-100 hover:border-cyan-200/40"
                >
                  Open Dashboard
                </Link>
              </div>
              <div className="grid gap-2 pt-1 sm:grid-cols-3">
                {signalCards.map((card, index) => (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * index + 0.1, duration: 0.3 }}
                    className="rounded-2xl border border-cyan-200/15 bg-black/30 p-3"
                  >
                    <p className="text-xs uppercase tracking-[0.12em] text-cyan-100/85">{card.title}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-100">{card.value}</p>
                    <p className="mt-1 text-xs text-slate-300">{card.detail}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </PremiumCard>

          <PremiumCard className="overflow-hidden border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(6,12,23,0.92),rgba(4,8,18,0.92))] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-100">
                <Clapperboard className="h-4 w-4 text-cyan-300" />
                Animated Editor Demo
              </p>
              <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-100">
                Preview
              </span>
            </div>
            <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/15 bg-black/45 shadow-[0_24px_72px_-40px_rgba(0,0,0,0.92)]">
              <video
                src="/editor-help-sample.mp4"
                poster="/og-preview-v3.png"
                autoPlay
                muted
                playsInline
                className="aspect-video w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl border border-white/15 bg-black/55 p-2 backdrop-blur-sm">
                <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.1em] text-slate-200">
                  <span>Timeline Assist</span>
                  <span>Retention Scan Active</span>
                </div>
                <div className="relative h-1.5 rounded-full bg-white/15">
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-purple-300"
                    animate={{ width: ["14%", "68%", "22%", "82%"] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              </div>
              <motion.div
                className="pointer-events-none absolute right-3 top-3 rounded-full border border-emerald-300/35 bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-100"
                animate={{ opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                Hook score rising
              </motion.div>
            </div>
            <p className="mt-3 text-xs text-slate-300">
              This demo mirrors the editor pipeline with animated timeline assist and retention tracking overlays.
            </p>
          </PremiumCard>
        </motion.section>

        <section className="grid gap-4 md:grid-cols-3">
          {featureCards.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.06 * index + 0.18, ease: "easeOut" }}
            >
              <PremiumCard className="h-full border border-white/10 p-5">
                <feature.icon className="h-5 w-5 text-cyan-300" />
                <h2 className="mt-2 text-lg font-semibold text-slate-100">{feature.title}</h2>
                <p className="mt-2 text-sm text-slate-300">{feature.description}</p>
              </PremiumCard>
            </motion.div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
