import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import LandingDemoEditorModal from "@/components/landing/LandingDemoEditorModal";

type MobilePlanId = "starter" | "creator" | "studio";

const MOBILE_CREATOR_PROOF = [
  { name: "Zach King", initials: "ZK" },
  { name: "Tom Bilyeu", initials: "TB" },
  { name: "Jubilee", initials: "JU" },
  { name: "Valuetainment", initials: "VA" },
] as const;

const MOBILE_POWERED_BY = ["NEXT.js", "Vercel", "python", "FFmpeg", "C++"] as const;

const MOBILE_PLAN_CONFIG: Record<
  MobilePlanId,
  {
    label: string;
    price: string;
    promo: string;
    cta: string;
    href: string;
    cardClass: string;
    priceClass: string;
    ctaClass: string;
  }
> = {
  starter: {
    label: "Starter",
    price: "$5/month",
    promo: "80% off",
    cta: "Start Free Trial",
    href: "/signup",
    cardClass:
      "border-emerald-400/45 bg-[linear-gradient(155deg,rgba(17,75,54,0.82)_0%,rgba(17,21,50,0.92)_70%)]",
    priceClass: "text-emerald-300",
    ctaClass:
      "bg-[linear-gradient(135deg,#7d4cff_0%,#9156ff_42%,#6f46ff_100%)] text-white hover:brightness-110",
  },
  creator: {
    label: "Creator",
    price: "$15/month",
    promo: "70% off",
    cta: "Unlock Creator",
    href: "/pricing",
    cardClass:
      "border-primary/45 bg-[linear-gradient(155deg,rgba(57,40,112,0.82)_0%,rgba(17,20,49,0.94)_72%)]",
    priceClass: "text-primary",
    ctaClass:
      "bg-[linear-gradient(135deg,#5f76ff_0%,#7390ff_45%,#5264f1_100%)] text-white hover:brightness-110",
  },
  studio: {
    label: "Studio",
    price: "$39/month",
    promo: "Best ROI",
    cta: "Scale With Studio",
    href: "/pricing",
    cardClass:
      "border-cyan-300/40 bg-[linear-gradient(155deg,rgba(20,59,82,0.8)_0%,rgba(15,26,49,0.94)_74%)]",
    priceClass: "text-cyan-200",
    ctaClass:
      "bg-[linear-gradient(135deg,#12b8ff_0%,#22d3ee_46%,#0ea5e9_100%)] text-slate-950 hover:brightness-110",
  },
};

const Index = () => {
  const [mobilePlan, setMobilePlan] = useState<MobilePlanId>("starter");
  const activeMobilePlan = useMemo(() => MOBILE_PLAN_CONFIG[mobilePlan], [mobilePlan]);

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="flex w-full flex-col items-center px-4 pb-10 pt-20 sm:px-6 sm:pt-24 sm:pb-16 md:min-h-screen md:justify-center lg:pb-20">
        {/* Mobile Compact Landing */}
        <div className="w-full max-w-[560px] md:hidden">
          <motion.section
            className="text-center"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <h1 className="mx-auto max-w-[12ch] text-[clamp(2.1rem,11vw,3rem)] font-black font-display leading-[0.92] tracking-[-0.03em] text-foreground">
              The Fastest Way to Edit Viral Videos
            </h1>
            <p className="mt-3 text-[1.45rem] font-semibold leading-[1.12] text-foreground/95">
              Instant preview. Smart edit. No clutter.
            </p>
            <p className="mx-auto mt-2 max-w-[35ch] text-[0.98rem] leading-[1.38] text-muted-foreground">
              Pick a mode and hit Run. We keep the flow clean and show only the result-focused progress by default.
            </p>
          </motion.section>

          <motion.section
            className="mt-5 overflow-hidden rounded-2xl border border-white/15 bg-black/70 shadow-[0_30px_80px_-48px_rgba(49,130,246,0.8)]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.55, ease: "easeOut" }}
          >
            <div className="relative aspect-video">
              <video
                src="/demo/landing-demo-input-2min.mp4"
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/45" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Link to="/editor">
                  <Button
                    size="lg"
                    className="h-12 rounded-2xl border border-cyan-300/60 bg-[linear-gradient(145deg,rgba(2,25,72,0.92)_0%,rgba(3,71,153,0.72)_60%,rgba(17,113,196,0.78)_100%)] px-9 text-xl font-semibold text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.38),0_0_32px_rgba(34,211,238,0.45),inset_0_0_16px_rgba(34,211,238,0.28)] hover:brightness-110"
                  >
                    Run Demo
                  </Button>
                </Link>
              </div>
            </div>
          </motion.section>

          <motion.section
            className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45 }}
          >
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Used By Creators
            </p>
            <div className="mt-2 flex items-center gap-2.5 overflow-x-auto pb-1">
              {MOBILE_CREATOR_PROOF.map((creator) => (
                <div
                  key={creator.name}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1.5"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(58,111,249,0.82),rgba(49,196,255,0.92))] text-[10px] font-semibold text-white">
                    {creator.initials}
                  </span>
                  <span className="text-sm font-medium text-foreground/90">{creator.name}</span>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section
            className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.45 }}
          >
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Powered By
            </p>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {MOBILE_POWERED_BY.map((company) => (
                <span
                  key={company}
                  className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm font-semibold text-foreground/90"
                >
                  {company}
                </span>
              ))}
            </div>
          </motion.section>

          <motion.section
            className="mt-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/90">
              Creator Subscription Plans
            </p>

            <div className="mt-3 inline-flex w-full rounded-full border border-white/12 bg-white/[0.04] p-1">
              {(["starter", "creator", "studio"] as const).map((plan) => (
                <button
                  key={plan}
                  type="button"
                  onClick={() => setMobilePlan(plan)}
                  className={`flex-1 rounded-full px-3 py-2 text-[13px] font-semibold uppercase tracking-[0.09em] transition ${
                    mobilePlan === plan
                      ? "bg-white/[0.14] text-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {plan}
                </button>
              ))}
            </div>

            <article className={`mt-3 rounded-2xl border p-5 text-center ${activeMobilePlan.cardClass}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/85">
                {activeMobilePlan.label}
              </p>
              <p className={`mt-3 text-[2.7rem] font-black leading-[0.95] tracking-[-0.03em] ${activeMobilePlan.priceClass}`}>
                {activeMobilePlan.price}
              </p>
              <p className="mt-1 text-[2rem] font-semibold text-foreground/90">{activeMobilePlan.promo}</p>
              <Link to={activeMobilePlan.href} className="mt-5 block">
                <Button className={`h-12 w-full rounded-xl text-lg font-semibold ${activeMobilePlan.ctaClass}`}>
                  {activeMobilePlan.cta}
                </Button>
              </Link>
            </article>
          </motion.section>
        </div>

        {/* Desktop / Tablet Landing */}
        <div className="hidden w-full md:block">
          <motion.div
            className="flex max-w-3xl mx-auto flex-col items-center text-center"
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
              className="mb-6 mx-auto max-w-[18ch] text-[clamp(1.92rem,9.4vw,6rem)] font-black font-display leading-[0.9] tracking-[-0.022em] text-foreground drop-shadow-[0_6px_16px_rgba(88,63,196,0.22)] sm:max-w-[16ch] sm:leading-[0.92] lg:max-w-[15ch]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
            >
              <span className="block text-balance">The Fastest Way to Edit</span>
              <span className="mt-2 inline-block rounded-[0.6rem] bg-primary px-3 py-1 text-white shadow-[0_20px_34px_-24px_hsl(var(--primary)/0.92)] sm:mt-3 sm:px-4">
                Viral Videos
              </span>
            </motion.h1>

            <motion.p
              className="max-w-xl mb-10 text-lg leading-relaxed text-muted-foreground"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              Upload your raw footage and let AI detect hooks, cut boring parts, match pacing to your niche, and render a polished final cut — automatically.
            </motion.p>

            <motion.div
              className="flex items-center gap-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.6 }}
            >
              <Link to="/editor">
                <Button size="lg" className="rounded-full px-8 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground glow-sm">
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button variant="ghost" size="lg" className="rounded-full px-8 text-muted-foreground hover:text-foreground">
                  View Pricing
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            className="mt-16 w-full max-w-6xl"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
          >
            <LandingDemoEditorModal />
          </motion.div>
        </div>
      </main>
    </GlowBackdrop>
  );
};

export default Index;
