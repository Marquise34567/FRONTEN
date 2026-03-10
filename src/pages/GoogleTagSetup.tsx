import { useCallback, useState } from "react";
import {
  Bell,
  Check,
  Clapperboard,
  Copy,
  Flame,
  FolderKanban,
  HelpCircle,
  Home,
  Instagram,
  Heart,
  Search,
  Sparkles,
  TrendingUp,
  Wand2,
  Youtube,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import SeoHead from "@/components/SeoHead";

const trackingId = "AW-17981894798";

const googleTagSnippet = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-17981894798"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-17981894798');
</script>`;

const eventSnippet = `<!-- Event snippet for Page view conversion page -->
<script>
  gtag('event', 'conversion', {'send_to': 'AW-17981894798/TZAbCN2on4AcEI7ht_5C'});
</script>`;

type CopyTarget = "id" | "google-tag" | "event-snippet" | null;

const sidebarItems = [
  { key: "home", label: "Home", icon: Home },
  { key: "projects", label: "Projects", icon: Clapperboard },
  { key: "clips", label: "Clips", icon: FolderKanban },
  { key: "ai", label: "AI", icon: Wand2 },
];

const socialPulseCards = [
  {
    label: "YouTube Shorts",
    stat: "Loop rate +43%",
    hint: "scroll-stopper hooks",
    icon: Youtube,
    positionClass: "-left-4 top-5 md:-left-12 md:top-7",
    cardClass: "border-red-300/30 bg-red-500/10 text-red-100 shadow-[0_12px_26px_rgba(248,113,113,0.24)]",
    iconWrapClass: "bg-red-500/20 text-red-200",
  },
  {
    label: "IG Reels",
    stat: "Shares +28%",
    hint: "tap-forward pacing",
    icon: Instagram,
    positionClass: "right-2 top-5 md:right-10 md:top-8",
    cardClass: "border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-100 shadow-[0_12px_26px_rgba(232,121,249,0.22)]",
    iconWrapClass: "bg-fuchsia-500/20 text-fuchsia-100",
  },
  {
    label: "Retention Pulse",
    stat: "A+ hook score",
    hint: "3-sec hold climbing",
    icon: TrendingUp,
    positionClass: "left-8 bottom-6 md:left-24 md:bottom-8",
    cardClass: "border-teal-300/30 bg-teal-400/10 text-teal-100 shadow-[0_12px_26px_rgba(45,212,191,0.2)]",
    iconWrapClass: "bg-teal-400/20 text-teal-100",
  },
] as const;

const socialTicker = [
  "#ytshorts momentum",
  "#viral hook",
  "#igreels pacing",
  "#creator edit",
  "#watch-time boost",
  "#share-ready",
] as const;

const GoogleTagSetup = () => {
  const [copied, setCopied] = useState<CopyTarget>(null);
  const shouldReduceMotion = useReducedMotion();

  const handleCopy = useCallback(async (target: Exclude<CopyTarget, null>, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      window.setTimeout(() => {
        setCopied((current) => (current === target ? null : current));
      }, 1800);
    } catch {
      setCopied(null);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#020405] text-[#f8fbfb]">
      <SeoHead
        title="Google Ads Tracking Setup Preview | AutoEditor"
        description="Internal preview page for Google Ads conversion tracking setup."
        path="/preview/google-ads-tracking"
        noindex
      />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(78rem_42rem_at_75%_-5%,rgba(13,148,136,0.16),transparent_60%),radial-gradient(60rem_36rem_at_0%_100%,rgba(12,74,110,0.16),transparent_65%)]" />
      <div className="relative flex min-h-screen">
        <aside className="hidden w-20 flex-col items-center border-r border-white/5 bg-black/35 px-3 py-5 md:flex">
          <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-xl border border-teal-300/30 bg-teal-400/10 text-teal-200 shadow-[0_0_28px_rgba(20,184,166,0.22)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <nav className="flex flex-1 flex-col items-center gap-3">
            {sidebarItems.map((item, index) => {
              const Icon = item.icon;
              const active = index === 0;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`group flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                    active
                      ? "border-teal-300/35 bg-teal-300/12 text-teal-100"
                      : "border-transparent bg-white/[0.02] text-slate-400 hover:border-teal-300/25 hover:bg-teal-300/10 hover:text-teal-100"
                  }`}
                  aria-label={item.label}
                >
                  <Icon className="h-5 w-5" />
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="h-16 border-b border-white/5 bg-black/45 px-4 backdrop-blur-xl md:px-8">
            <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-400/15 text-teal-200">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span className="text-sm font-semibold tracking-wide text-slate-100">Opus AI Studio</span>
              </div>

              <div className="hidden flex-1 justify-center md:flex">
                <label className="flex h-10 w-full max-w-xl items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-slate-300">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input
                    type="search"
                    placeholder="Search projects, snippets, docs"
                    className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </label>
              </div>

              <div className="flex min-w-0 items-center justify-end gap-3">
                <button
                  type="button"
                  className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:border-teal-300/35 hover:text-teal-100"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-teal-300" />
                </button>
                <div className="h-9 w-9 rounded-full border border-teal-300/35 bg-gradient-to-br from-slate-100 to-slate-300" />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8 md:py-10">
            <div className="mx-auto w-full max-w-[1600px] space-y-6">
              <section className="relative overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(155deg,rgba(20,184,166,0.12),rgba(15,23,42,0.5)_48%,rgba(0,0,0,0.72))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.45)] md:p-10">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(248,113,113,0.14),transparent_36%),radial-gradient(circle_at_82%_16%,rgba(232,121,249,0.16),transparent_38%),radial-gradient(circle_at_55%_88%,rgba(45,212,191,0.13),transparent_44%)]" />

                {socialPulseCards.map((card, index) => {
                  const Icon = card.icon;
                  return (
                    <motion.div
                      key={card.label}
                      className={`pointer-events-none absolute hidden md:block ${card.positionClass}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={
                        shouldReduceMotion ? { opacity: 0.8, y: 0 } : { opacity: [0.38, 0.96, 0.38], y: [0, -10, 0] }
                      }
                      transition={{
                        opacity: { duration: 0.6, delay: 0.2 + index * 0.08 },
                        y: {
                          duration: 3 + index * 0.45,
                          repeat: shouldReduceMotion ? 0 : Infinity,
                          ease: "easeInOut",
                          delay: index * 0.26,
                        },
                      }}
                    >
                      <div className={`rounded-2xl border px-3 py-2 backdrop-blur-sm ${card.cardClass}`}>
                        <div className="flex items-center gap-2">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.iconWrapClass}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em]">{card.label}</p>
                            <p className="text-sm font-semibold">{card.stat}</p>
                          </div>
                        </div>
                        <p className="mt-1 text-[11px] text-white/75">{card.hint}</p>
                      </div>
                    </motion.div>
                  );
                })}

                <motion.div
                  className="pointer-events-none absolute -right-20 top-10 h-44 w-44 rounded-full border border-red-300/25"
                  animate={shouldReduceMotion ? { opacity: 0.3 } : { scale: [0.92, 1.08, 0.92], opacity: [0.18, 0.42, 0.18] }}
                  transition={{ duration: 5.2, repeat: shouldReduceMotion ? 0 : Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  className="pointer-events-none absolute -left-12 bottom-6 h-36 w-36 rounded-full border border-fuchsia-300/25"
                  animate={shouldReduceMotion ? { opacity: 0.28 } : { scale: [1.08, 0.88, 1.08], opacity: [0.16, 0.4, 0.16] }}
                  transition={{ duration: 5.8, repeat: shouldReduceMotion ? 0 : Infinity, ease: "easeInOut", delay: 0.4 }}
                />

                <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-300/25 bg-teal-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-teal-100">
                  Google Ads Setup
                </p>
                <h1 className="max-w-3xl text-2xl font-semibold leading-tight text-white md:text-4xl">
                  We haven&apos;t found a Google tag on your website
                </h1>
                <div className="relative z-10 mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300/30 bg-red-500/10 px-3 py-1 text-red-100">
                    <Youtube className="h-3.5 w-3.5" />
                    YouTube Shorts style
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-300/30 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-100">
                    <Instagram className="h-3.5 w-3.5" />
                    Instagram Reels style
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/30 bg-teal-400/10 px-3 py-1 text-teal-100">
                    <Flame className="h-3.5 w-3.5" />
                    Viral motion overlays
                  </span>
                </div>
                <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
                  We&apos;re sharing these instructions to help you set up tracking for conversions
                </p>

                <div className="pointer-events-none absolute inset-x-4 bottom-4 hidden overflow-hidden rounded-full border border-white/10 bg-black/25 md:block">
                  <motion.div
                    className="flex w-max gap-2 whitespace-nowrap px-3 py-1.5"
                    animate={shouldReduceMotion ? { x: 0 } : { x: ["0%", "-50%"] }}
                    transition={{ duration: 20, repeat: shouldReduceMotion ? 0 : Infinity, ease: "linear" }}
                  >
                    {[...socialTicker, ...socialTicker].map((tag, index) => (
                      <span key={`${tag}-${index}`} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-slate-200/80">
                        {tag}
                      </span>
                    ))}
                  </motion.div>
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <article className="flex h-full flex-col rounded-3xl border border-white/8 bg-[#070d10] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                  <h2 className="text-lg font-semibold text-white">
                    Option 1: Install a tracking ID through your hosting service or commerce platform
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    Sign in to your website builder, web hosting service, or commerce platform and paste your tracking ID into
                    the analytics section.
                  </p>

                  <div className="mt-6 flex items-center gap-3">
                    <span className="inline-flex items-center rounded-full border border-teal-300/35 bg-teal-300/12 px-3 py-1 text-xs font-semibold tracking-wide text-teal-100">
                      {trackingId}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopy("id", trackingId)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-teal-300/30 bg-teal-300/12 text-teal-100 transition hover:bg-teal-300/18"
                      aria-label="Copy tracking ID"
                    >
                      {copied === "id" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </article>

                <article className="flex h-full flex-col rounded-3xl border border-white/8 bg-[#070d10] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                  <h2 className="text-lg font-semibold text-white">Option 2: Install a Google tag in your website code</h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    Paste your Google tag before the closing {"</head>"} tag on every page of your website you want to track.
                  </p>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Google Tag Snippet</span>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300"
                            aria-label="Google tag placement"
                          >
                            <HelpCircle className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="border-white/10 bg-[#061014] text-xs text-slate-100">
                          Paste in every page&apos;s {"<head>"}
                        </TooltipContent>
                      </Tooltip>
                      <button
                        type="button"
                        onClick={() => void handleCopy("google-tag", googleTagSnippet)}
                        className="inline-flex items-center gap-2 rounded-lg border border-teal-300/30 bg-teal-300/12 px-3 py-1.5 text-xs font-medium text-teal-100 transition hover:bg-teal-300/18"
                      >
                        {copied === "google-tag" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy Code
                      </button>
                    </div>
                  </div>

                  <div className="relative mt-3">
                    <motion.div
                      className="pointer-events-none absolute -inset-1 rounded-2xl border border-red-300/25"
                      animate={shouldReduceMotion ? { opacity: 0.35 } : { opacity: [0.2, 0.52, 0.2], scale: [0.995, 1.008, 0.995] }}
                      transition={{ duration: 2.8, repeat: shouldReduceMotion ? 0 : Infinity, ease: "easeInOut" }}
                    />
                    <div className="pointer-events-none absolute -top-2.5 left-3 hidden items-center gap-1 rounded-full border border-red-300/30 bg-red-500/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-red-100 md:inline-flex">
                      <Youtube className="h-3 w-3" />
                      Shorts Burst
                    </div>
                    <div className="pointer-events-none absolute -top-2.5 right-3 hidden items-center gap-1 rounded-full border border-fuchsia-300/30 bg-fuchsia-500/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-fuchsia-100 md:inline-flex">
                      <Instagram className="h-3 w-3" />
                      Reels Glow
                    </div>
                    <pre className="relative overflow-x-auto rounded-2xl border border-white/8 bg-[#050a0c] p-4 font-mono text-xs leading-6 text-slate-200">
                      <code>{googleTagSnippet}</code>
                    </pre>
                  </div>
                </article>
              </section>

              <section className="rounded-3xl border border-white/8 bg-[#070d10] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.45)] md:p-8">
                <h3 className="max-w-5xl text-lg font-semibold text-white md:text-xl">
                  Lastly, install an event snippet for each of your goals to measure website conversions
                </h3>
                <p className="mt-3 max-w-5xl text-sm leading-relaxed text-slate-300">
                  Copy the snippet below and paste it in between the {"<head></head>"} tags of the page(s) you&apos;d like to
                  track, right after the Google tag
                </p>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-400">Conversion Event Snippet</span>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300"
                          aria-label="Event snippet placement"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="border-white/10 bg-[#061014] text-xs text-slate-100">
                        Only on conversion/thank-you pages
                      </TooltipContent>
                    </Tooltip>
                    <button
                      type="button"
                      onClick={() => void handleCopy("event-snippet", eventSnippet)}
                      className="inline-flex items-center gap-2 rounded-lg border border-teal-300/30 bg-teal-300/12 px-3 py-1.5 text-xs font-medium text-teal-100 transition hover:bg-teal-300/18"
                    >
                      {copied === "event-snippet" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy Code
                    </button>
                  </div>
                </div>

                <div className="relative mt-3">
                  <motion.div
                    className="pointer-events-none absolute -inset-1 rounded-2xl border border-teal-300/25"
                    animate={shouldReduceMotion ? { opacity: 0.35 } : { opacity: [0.18, 0.48, 0.18], scale: [0.995, 1.007, 0.995] }}
                    transition={{ duration: 3.1, repeat: shouldReduceMotion ? 0 : Infinity, ease: "easeInOut", delay: 0.2 }}
                  />
                  <div className="pointer-events-none absolute -top-2.5 left-3 hidden items-center gap-1 rounded-full border border-teal-300/30 bg-teal-400/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-teal-100 md:inline-flex">
                    <TrendingUp className="h-3 w-3" />
                    Viral Trigger
                  </div>
                  <div className="pointer-events-none absolute -top-2.5 right-3 hidden items-center gap-1 rounded-full border border-white/20 bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-100 md:inline-flex">
                    <Heart className="h-3 w-3" />
                    Reel Engagement
                  </div>
                  <pre className="relative overflow-x-auto rounded-2xl border border-white/8 bg-[#050a0c] p-4 font-mono text-xs leading-6 text-slate-200">
                    <code>{eventSnippet}</code>
                  </pre>
                </div>

                <p className="mt-6 rounded-2xl border border-teal-300/20 bg-teal-300/10 px-4 py-3 text-sm text-teal-100">
                  Once added, your conversions will start tracking automatically
                </p>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default GoogleTagSetup;
