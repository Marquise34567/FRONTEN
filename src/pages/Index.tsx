import { motion } from "framer-motion";
import { ArrowRight, ChartNoAxesColumn, Clapperboard, PlayCircle, Sparkles, Wand2, Workflow } from "lucide-react";
import { Link } from "react-router-dom";

import AppShell from "@/components/premium/AppShell";
import PremiumCard from "@/components/premium/PremiumCard";
import PurpleAccentButton from "@/components/premium/PurpleAccentButton";

const signalCards = [
  {
    title: "Hook Win Rate",
    value: "+31%",
    detail: "3-5s intros rewritten using retention risk.",
  },
  {
    title: "Edit Throughput",
    value: "4.3x",
    detail: "Upload once, generate multi-platform cuts.",
  },
  {
    title: "Revision Cycles",
    value: "-52%",
    detail: "Insights + re-render loops in one screen.",
  },
];

const pipelineSteps = [
  "Upload + Scene Scan",
  "Hook Optimization",
  "Pacing + Cut Engine",
  "Captions + Audio Pass",
  "Export + Review",
];

const featureCards = [
  {
    title: "Adaptive Pipeline",
    description: "Horizontal and vertical outputs are tuned separately, not stretched from one timeline.",
    icon: Workflow,
  },
  {
    title: "Retention Graphing",
    description: "See where people skip, where they stay, then iterate with targeted fixes.",
    icon: ChartNoAxesColumn,
  },
  {
    title: "Creator-Ready Deliverables",
    description: "Final output, thumbnails, and replayable pipeline logs are packaged after each render.",
    icon: Clapperboard,
  },
];

export default function Index() {
  return (
    <AppShell title="AutoEditor">
      <div className="space-y-4">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]"
        >
          <PremiumCard className="overflow-hidden border border-cyan-300/20 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(56,189,248,0.24),transparent_56%),radial-gradient(90%_120%_at_100%_0%,rgba(217,70,239,0.2),transparent_60%),linear-gradient(180deg,rgba(8,16,30,0.95),rgba(5,10,20,0.95))] p-7 md:p-8">
            <div className="max-w-3xl space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/35 bg-cyan-500/15 px-3 py-1 text-xs uppercase tracking-[0.14em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                Demo Restored
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
              </div>
              <div className="grid gap-2 pt-1 sm:grid-cols-3">
                {signalCards.map((card) => (
                  <div key={card.title} className="rounded-2xl border border-cyan-200/15 bg-black/30 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-cyan-100/85">{card.title}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-100">{card.value}</p>
                    <p className="mt-1 text-xs text-slate-300">{card.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </PremiumCard>

          <PremiumCard className="overflow-hidden border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(6,12,23,0.92),rgba(4,8,18,0.92))] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-100">
                <PlayCircle className="h-4 w-4 text-cyan-300" />
                Landing Demo
              </p>
              <span className="rounded-full border border-white/15 bg-black/35 px-2 py-1 text-[11px] text-slate-300">
                Live preview
              </span>
            </div>
            <div className="mt-3 overflow-hidden rounded-2xl border border-white/15 bg-black/45 shadow-[0_24px_72px_-40px_rgba(0,0,0,0.92)]">
              <video
                src="/editor-help-sample.mp4"
                poster="/og-preview-v3.png"
                controls
                muted
                playsInline
                loop
                className="aspect-video w-full object-cover"
              />
            </div>
            <p className="mt-3 text-xs text-slate-300">
              Your original demo is now back on the landing page and connected directly to the editor experience.
            </p>
          </PremiumCard>
        </motion.section>

        <section className="grid gap-4 md:grid-cols-3">
          {featureCards.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.06 * index, ease: "easeOut" }}
            >
              <PremiumCard className="h-full border border-white/10 p-5">
                <feature.icon className="h-5 w-5 text-cyan-300" />
                <h2 className="mt-2 text-lg font-semibold text-slate-100">{feature.title}</h2>
                <p className="mt-2 text-sm text-slate-300">{feature.description}</p>
              </PremiumCard>
            </motion.div>
          ))}
        </section>

        <PremiumCard className="border border-white/10 p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Pipeline Snapshot</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-100">From upload to export in five visible stages</h3>
          <div className="mt-4 grid gap-2 md:grid-cols-5">
            {pipelineSteps.map((step, index) => (
              <div key={step} className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.1em] text-cyan-200/90">Step {index + 1}</p>
                <p className="mt-1 text-sm text-slate-100">{step}</p>
              </div>
            ))}
          </div>
        </PremiumCard>
      </div>
    </AppShell>
  );
}
