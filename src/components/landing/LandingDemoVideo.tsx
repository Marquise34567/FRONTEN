import { motion } from "framer-motion";
import { Play, Sparkles, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

const LOOP_SECONDS = 18;
const TICK_MS = 120;

type LandingDemoVideoProps = {
  className?: string;
};

const metrics = [
  { label: "Virality", value: "92" },
  { label: "Hook", value: "+31%" },
  { label: "Pacing", value: "Fast" },
];

export default function LandingDemoVideo({ className }: LandingDemoVideoProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setElapsed((current) => (current + TICK_MS / 1000) % LOOP_SECONDS);
    }, TICK_MS);

    return () => window.clearInterval(timerId);
  }, []);

  const retention = useMemo(() => Math.round(62 + ((elapsed / LOOP_SECONDS) * 30) % 30), [elapsed]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(165deg,rgba(8,12,18,0.96),rgba(6,8,12,0.94))] p-4",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_80%_0%,rgba(180,119,255,0.18),transparent_70%),radial-gradient(52%_44%_at_10%_10%,rgba(47,228,200,0.16),transparent_74%)]" />

      <div className="relative z-10 rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/30 bg-cyan-400/12 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-cyan-100">
            <Sparkles className="h-3.5 w-3.5" />
            Active Retention Scan
          </span>
          <span className="rounded-full border border-white/14 bg-white/[0.03] px-3 py-1 text-[11px] text-slate-200">{retention}% predicted</span>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(9,14,20,0.92),rgba(10,9,17,0.9))] p-3">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
            <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_20%,rgba(47,228,200,0.08),transparent_80%)]" />
            <div className="absolute inset-0 grid place-items-center">
              <button
                type="button"
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white"
              >
                <Play className="h-5 w-5" />
              </button>
            </div>

            <div className="absolute bottom-2 left-2 right-2 rounded-lg border border-white/10 bg-black/45 p-2">
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <Waves className="h-3 w-3 text-cyan-100" />
                  Timeline waveform
                </span>
                <span>00:{Math.round(elapsed).toString().padStart(2, "0")}</span>
              </div>
              <div className="flex h-7 items-end gap-1">
                {Array.from({ length: 28 }).map((_, index) => {
                  const wave = 5 + (((index * 11 + Math.floor(elapsed * 20)) % 16) as number);
                  return (
                    <motion.div
                      key={index}
                      className="w-1 rounded-full bg-[linear-gradient(180deg,rgba(47,228,200,0.75),rgba(180,119,255,0.72))]"
                      animate={{ height: `${wave}px` }}
                      transition={{ duration: 0.24, ease: "easeInOut" }}
                    />
                  );
                })}
                <div className="ml-1 h-7 w-[2px] rounded-full bg-cyan-200/90" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
              <p className="mt-1 text-sm font-semibold text-cyan-100">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
