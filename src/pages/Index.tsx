import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";

import AppShell from "@/components/premium/AppShell";
import PremiumCard from "@/components/premium/PremiumCard";
import PurpleAccentButton from "@/components/premium/PurpleAccentButton";

const featureCards = [
  {
    title: "Hook Intelligence",
    detail: "Detects strongest 3-5s openers and predicts drop risks before render.",
  },
  {
    title: "Adaptive Pacing",
    detail: "Applies micro-hooks, dynamic cut cadence, and retention-focused zoom timing.",
  },
  {
    title: "Explainable Analytics",
    detail: "Every edit shows why it was chosen and what watch-time uplift it contributes.",
  },
];

const testimonials = [
  { quote: "Our Shorts retention jumped from 46% to 74% in two weeks.", name: "Lena, Creator Studio" },
  { quote: "Hook explanations helped us train junior editors fast.", name: "Mika, Growth Team" },
  { quote: "The deep-dive graph is now part of every post-mortem.", name: "Ravi, Agency Lead" },
];

const partners = ["Creator Labs", "Studio Neon", "Signal Media", "GrowthOps Collective"];

export default function Index() {
  return (
    <AppShell title="AutoEditor">
      <div className="space-y-4">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <PremiumCard className="relative overflow-hidden p-8 md:p-10">
            <div className="pointer-events-none absolute -left-12 -top-20 h-64 w-64 rounded-full bg-purple-500/18 blur-3xl" />
            <div className="pointer-events-none absolute -right-10 top-10 h-48 w-48 rounded-full bg-fuchsia-500/14 blur-3xl" />

            <div className="relative mx-auto max-w-4xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-purple-300/35 bg-purple-500/12 px-3 py-1 text-xs uppercase tracking-[0.14em] text-purple-100">
                <Sparkles className="h-3.5 w-3.5" />
                Premium 2026 AI Editing
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-100 md:text-6xl">
                AutoEditor, built to maximize viewer retention on every cut
              </h1>
              <p className="mx-auto mt-3 max-w-3xl text-base text-slate-300 md:text-lg">
                Upload once, then AutoEditor finds hooks, predicts drop-offs, and generates high-retention edits for Shorts, Reels, and YouTube.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <PurpleAccentButton asChild size="lg" icon={<Wand2 className="h-4 w-4" />}>
                  <Link to="/editor">
                    Open Editor
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </PurpleAccentButton>
                <Link
                  to="/pricing"
                  className="inline-flex items-center rounded-2xl border border-white/15 bg-black/35 px-5 py-3 text-sm text-slate-100 hover:border-purple-300/35"
                >
                  View Pricing
                </Link>
              </div>
            </div>
          </PremiumCard>
        </motion.section>

        <section className="grid gap-4 md:grid-cols-3">
          {featureCards.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.08 }}
            >
              <PremiumCard className="h-full p-5">
                <p className="text-sm font-semibold text-slate-100">{feature.title}</p>
                <p className="mt-2 text-sm text-slate-300">{feature.detail}</p>
              </PremiumCard>
            </motion.div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <PremiumCard className="p-5">
            <h2 className="text-xl font-semibold text-slate-100">Testimonials</h2>
            <div className="mt-3 space-y-3">
              {testimonials.map((item) => (
                <div key={item.name} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-sm text-slate-100">“{item.quote}”</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.12em] text-purple-200">{item.name}</p>
                </div>
              ))}
            </div>
          </PremiumCard>
          <PremiumCard className="p-5">
            <h2 className="text-xl font-semibold text-slate-100">Trusted by</h2>
            <div className="mt-3 grid gap-2">
              {partners.map((partner) => (
                <div key={partner} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-200">
                  {partner}
                </div>
              ))}
            </div>
          </PremiumCard>
        </section>
      </div>
    </AppShell>
  );
}
