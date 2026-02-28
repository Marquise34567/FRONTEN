import { useCallback, useState } from "react";
import {
  Bell,
  Check,
  Clapperboard,
  Copy,
  FolderKanban,
  HelpCircle,
  Home,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

const GoogleTagSetup = () => {
  const [copied, setCopied] = useState<CopyTarget>(null);

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
              <div className="flex min-w-[140px] items-center gap-2">
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

              <div className="flex min-w-[90px] items-center justify-end gap-3">
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
              <section className="rounded-3xl border border-white/8 bg-[linear-gradient(155deg,rgba(20,184,166,0.12),rgba(15,23,42,0.5)_48%,rgba(0,0,0,0.72))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.45)] md:p-10">
                <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-300/25 bg-teal-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-teal-100">
                  Google Ads Setup
                </p>
                <h1 className="max-w-3xl text-2xl font-semibold leading-tight text-white md:text-4xl">
                  We haven&apos;t found a Google tag on your website
                </h1>
                <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
                  We&apos;re sharing these instructions to help you set up tracking for conversions
                </p>
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

                  <pre className="mt-3 overflow-x-auto rounded-2xl border border-white/8 bg-[#050a0c] p-4 font-mono text-xs leading-6 text-slate-200">
                    <code>{googleTagSnippet}</code>
                  </pre>
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

                <pre className="mt-3 overflow-x-auto rounded-2xl border border-white/8 bg-[#050a0c] p-4 font-mono text-xs leading-6 text-slate-200">
                  <code>{eventSnippet}</code>
                </pre>

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
