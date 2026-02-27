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
    detail: "First seconds are scored and upgraded before render.",
  },
  {
    title: "Edit Throughput",
    value: "4.3x",
    detail: "Single upload becomes platform-ready cut sets.",
  },
  {
    title: "Revision Cycles",
    value: "-52%",
    detail: "Fewer manual retries before publish-ready output.",
  },
];

const featureCards = [
  {
    title: "Adaptive Pipeline",
    description: "Vertical and horizontal versions are tuned separately, not stretched from one source timeline.",
    icon: Workflow,
  },
  {
    title: "Retention Graphing",
    description: "See drop zones and retention peaks, then apply correction steps in-editor.",
    icon: ChartNoAxesColumn,
  },
  {
    title: "Creator Deliverables",
    description: "Exports, thumbnails, and retention notes are bundled for immediate publishing.",
    icon: Clapperboard,
  },
];

const pipelineCards = [
  {
    title: "Frame + Speech Scan",
    value: 96,
    detail: "Video frames and transcript cues are fused for retention scoring.",
  },
  {
    title: "Hook Candidate Ranking",
    value: 84,
    detail: "Top opener segments are ranked and trimmed into the opening window.",
  },
  {
    title: "Boring Part Suppression",
    value: 78,
    detail: "Low-engagement and silent sections are compressed out of the cut plan.",
  },
  {
    title: "Final Render Packaging",
    value: 92,
    detail: "Captions, style, and platform formats are finalized for export.",
  },
];

export default function Index() {
  return (
    <AppShell title="AutoEditor">
      <div className="space-y-5">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="mx-auto max-w-6xl"
        >
          <PremiumCard className="relative overflow-hidden border border-cyan-300/20 bg-[radial-gradient(115%_120%_at_0%_0%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(80%_100%_at_100%_0%,rgba(6,182,212,0.18),transparent_62%),linear-gradient(180deg,rgba(8,16,30,0.95),rgba(6,11,20,0.96))] p-7 md:p-10">
            <motion.div
              className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl"
              animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.55, 0.3] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="mx-auto max-w-4xl space-y-5 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/35 bg-cyan-500/12 px-3 py-1 text-xs uppercase tracking-[0.14em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                Retention-first editing
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-100 md:text-6xl">
                We Built an Editor That Thinks Like <span className="text-cyan-300">Top Creators</span>
              </h1>
              <p className="mx-auto max-w-3xl text-base text-slate-300 md:text-lg">
                Upload raw footage and the AI engine detects hooks, trims boring sections, aligns pacing, and exports
                polished cuts with retention feedback.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
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
              </div>
              <div className="grid gap-2 pt-2 sm:grid-cols-3">
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
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="mx-auto max-w-6xl"
        >
          <PremiumCard className="overflow-hidden border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(6,12,23,0.92),rgba(4,8,18,0.92))] p-4 md:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-100">
                <Clapperboard className="h-4 w-4 text-cyan-300" />
                Live Animated Editor Demo
              </p>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100">
                Preview
              </span>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
              <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black/45 shadow-[0_24px_72px_-40px_rgba(0,0,0,0.92)]">
                <video
                  src="/landing-demo.mp4"
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
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300"
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

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {pipelineCards.map((card, index) => (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: 0.08 * index + 0.12, ease: "easeOut" }}
                    className="rounded-2xl border border-cyan-200/15 bg-black/32 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-cyan-100/90">{card.title}</p>
                      <span className="text-xs text-slate-300">{card.value}%</span>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-white/15">
                      <motion.span
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-300 to-blue-300"
                        animate={{ width: [`${Math.max(24, card.value - 16)}%`, `${card.value}%`, `${Math.max(28, card.value - 10)}%`] }}
                        transition={{ duration: 5.8 + index * 0.6, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-300">{card.detail}</p>
                  </motion.div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-300">
              Same old landing flow style, rebuilt with the current premium component system and a live demo preview.
            </p>
          </PremiumCard>
        </motion.section>

        <section className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
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
