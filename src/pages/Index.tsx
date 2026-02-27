import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";

import AppShell from "@/components/premium/AppShell";
import PremiumCard from "@/components/premium/PremiumCard";
import PurpleAccentButton from "@/components/premium/PurpleAccentButton";

const features = [
  {
    title: "Retention-First AI Editing",
    description: "Hooks in 3-5 seconds, micro-hooks at drop risks, pacing tuned for watch-through.",
  },
  {
    title: "Adaptive Multi-Format Pipeline",
    description: "One source export to TikTok, Reels, Shorts, and long-form with platform-specific pacing.",
  },
  {
    title: "Realtime Deep Dive Analytics",
    description: "Interactive retention graph with skip-risk markers, corrective actions, and instant re-render loops.",
  },
];

const testimonials = [
  {
    quote: "We cut revision cycles in half and pushed average watch time up within two weeks.",
    author: "Mila R. • Creator Ops Lead",
  },
  {
    quote: "AutoEditor feels like a premium post team in one clean dashboard.",
    author: "Jordan K. • YouTube Brand Studio",
  },
];

const partnerships = ["Creator Studio Labs", "Shorts Growth Collective", "Reels Network", "StreamForge"];

export default function Index() {
  return (
    <AppShell title="AutoEditor">
      <div className="space-y-4">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <PremiumCard className="overflow-hidden bg-[radial-gradient(90%_120%_at_0%_0%,rgba(168,85,247,0.28),transparent_56%),radial-gradient(90%_130%_at_100%_0%,rgba(217,70,239,0.22),transparent_62%),linear-gradient(180deg,rgba(10,10,18,0.95),rgba(6,6,10,0.95))] p-8 md:p-10">
            <div className="max-w-4xl space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/35 bg-purple-500/15 px-3 py-1 text-xs uppercase tracking-[0.14em] text-purple-100">
                <Sparkles className="h-3.5 w-3.5" />
                2026 Creator OS
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-100 md:text-6xl">
                AI Video Editing Built To <span className="text-purple-300">Maximize Viewer Retention</span>
              </h1>
              <p className="max-w-2xl text-base text-slate-300 md:text-lg">
                AutoEditor predicts drop-off risk, injects hooks, rebalances pacing, and optimizes every timeline
                decision for higher average watch percentage.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <PurpleAccentButton asChild size="lg" icon={<Wand2 className="h-4 w-4" />}>
                  <Link to="/editor">
                    Start New Project
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </PurpleAccentButton>
                <Link
                  to="/pricing"
                  className="inline-flex items-center rounded-2xl border border-white/15 bg-black/40 px-5 py-3 text-sm text-slate-200 hover:border-white/30"
                >
                  View Pricing
                </Link>
              </div>
            </div>
          </PremiumCard>
        </motion.section>

        <section className="grid gap-4 md:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * index, ease: "easeInOut" }}
            >
              <PremiumCard className="h-full p-5">
                <h2 className="text-lg font-semibold text-slate-100">{feature.title}</h2>
                <p className="mt-2 text-sm text-slate-400">{feature.description}</p>
              </PremiumCard>
            </motion.div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <PremiumCard className="p-6">
            <h3 className="text-sm uppercase tracking-[0.13em] text-purple-200">Testimonials</h3>
            <div className="mt-4 space-y-4">
              {testimonials.map((testimonial) => (
                <div key={testimonial.author} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <p className="text-sm text-slate-200">{testimonial.quote}</p>
                  <p className="mt-2 text-xs text-slate-400">{testimonial.author}</p>
                </div>
              ))}
            </div>
          </PremiumCard>

          <PremiumCard className="p-6">
            <h3 className="text-sm uppercase tracking-[0.13em] text-purple-200">Partnerships</h3>
            <div className="mt-4 grid gap-2">
              {partnerships.map((name) => (
                <div
                  key={name}
                  className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-200"
                >
                  {name}
                </div>
              ))}
            </div>
          </PremiumCard>
        </section>
      </div>
    </AppShell>
  );
}
