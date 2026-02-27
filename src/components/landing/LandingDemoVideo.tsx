import { motion } from "framer-motion";
import { BarChart3, Cpu, Scissors, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

const LOOP_SECONDS = 28;
const TICK_MS = 90;

type LandingDemoVideoProps = {
  className?: string;
};

type DemoPhase = {
  id: string;
  label: string;
  copy: string;
  start: number;
  end: number;
};

const DEMO_PHASES: DemoPhase[] = [
  {
    id: "scan",
    label: "0-5s Upload + AI Scan",
    copy: "Analyzing motion vectors, transcript waveforms, and frame energy.",
    start: 0,
    end: 5,
  },
  {
    id: "hook",
    label: "5-12s Hook Detection",
    copy: "Zooming into the strongest opening sequence for hook certainty.",
    start: 5,
    end: 12,
  },
  {
    id: "pace",
    label: "12-20s Adaptive Pacing",
    copy: "Removing low-retention moments and inserting micro-hook boosts.",
    start: 12,
    end: 20,
  },
  {
    id: "retention",
    label: "20-25s Retention Lift",
    copy: "Projecting before vs after retention movement in real time.",
    start: 20,
    end: 25,
  },
  {
    id: "export",
    label: "25-28s Final Delivery",
    copy: "Delivering polished Shorts, Reels, and YouTube-ready cuts.",
    start: 25,
    end: 28,
  },
];

const PARTICLE_OFFSETS = [
  { top: "10%", left: "12%", duration: 5.4, delay: 0.2 },
  { top: "22%", left: "78%", duration: 6.8, delay: 1.1 },
  { top: "34%", left: "58%", duration: 5.8, delay: 1.8 },
  { top: "55%", left: "18%", duration: 7.2, delay: 0.4 },
  { top: "68%", left: "84%", duration: 6.1, delay: 2.2 },
  { top: "82%", left: "38%", duration: 6.6, delay: 1.5 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function findPhase(second: number) {
  return DEMO_PHASES.find((phase) => second >= phase.start && second < phase.end) ?? DEMO_PHASES[DEMO_PHASES.length - 1];
}

export default function LandingDemoVideo({ className }: LandingDemoVideoProps) {
  const [elapsed, setElapsed] = useState(0);
  const [videoUnavailable, setVideoUnavailable] = useState(false);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setElapsed((current) => (current + TICK_MS / 1000) % LOOP_SECONDS);
    }, TICK_MS);

    return () => window.clearInterval(timerId);
  }, []);

  const currentPhase = useMemo(() => findPhase(elapsed), [elapsed]);
  const scanProgress = clamp((elapsed / 5) * 100, 4, 100);
  const inHookPhase = elapsed >= 5 && elapsed < 12;
  const inPacingPhase = elapsed >= 12 && elapsed < 20;
  const inRetentionPhase = elapsed >= 20;
  const inFinalPhase = elapsed >= 25;
  const retentionAfter = Math.round(48 + clamp((elapsed - 20) / 5, 0, 1) * 34);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-white/15 bg-[linear-gradient(165deg,rgba(10,12,20,0.93),rgba(6,8,15,0.9))] p-3 md:p-4",
        className,
      )}
      style={{ filter: "drop-shadow(0 0 12px rgba(192,132,252,0.25))" }}
    >
      {!videoUnavailable ? (
        <video
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
          src="/landing-demo.mp4"
          autoPlay
          muted
          playsInline
          loop
          onError={() => setVideoUnavailable(true)}
          aria-hidden
        />
      ) : null}

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_80%_at_8%_0%,rgba(192,132,252,0.2),transparent_56%),radial-gradient(90%_90%_at_84%_8%,rgba(217,70,239,0.16),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.05)_0%,transparent_32%,transparent_68%,rgba(255,255,255,0.06)_100%)]" />

      {PARTICLE_OFFSETS.map((particle) => (
        <motion.span
          key={`${particle.top}-${particle.left}`}
          className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-fuchsia-300/65"
          style={{ top: particle.top, left: particle.left }}
          animate={{
            opacity: [0.2, 0.9, 0.25],
            y: [0, -8, 0],
            x: [0, 3, 0],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      <div className="relative z-10 rounded-[1.5rem] border border-white/10 bg-black/35 p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-300/35 bg-purple-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-purple-100">
            <Sparkles className="h-3.5 w-3.5" />
            Retention Demo Loop
          </span>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-slate-200">
            {currentPhase.label}
          </span>
        </div>

        <p className="mt-3 text-sm text-slate-200">{currentPhase.copy}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-[0.88fr_1fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                <Cpu className="h-3.5 w-3.5 text-fuchsia-200" />
                AI Scan
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="relative h-16 w-16 rounded-full p-[5px]"
                  style={{
                    background: `conic-gradient(#c084fc ${Math.round(scanProgress * 3.6)}deg, rgba(148,163,184,0.2) 0deg)`,
                  }}
                >
                  <div className="absolute inset-[5px] grid place-items-center rounded-full bg-[#090b12] text-[11px] font-semibold text-slate-100">
                    {Math.round(scanProgress)}%
                  </div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {Array.from({ length: 10 }).map((_, index) => {
                    const base = (index + 1) * 8;
                    const filled = scanProgress > base;
                    return (
                      <div
                        key={index}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          filled ? "bg-gradient-to-r from-purple-400 to-fuchsia-400" : "bg-slate-700/40",
                        )}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                <Wand2 className="h-3.5 w-3.5 text-purple-200" />
                Whisper Waveform
              </div>
              <div className="mt-3 flex h-16 items-end gap-1">
                {Array.from({ length: 24 }).map((_, index) => (
                  <motion.div
                    key={index}
                    className="w-1.5 rounded-full bg-gradient-to-t from-purple-500/40 to-fuchsia-300/80"
                    animate={{ height: [8, 14 + ((index * 7) % 28), 10] }}
                    transition={{
                      duration: 1.5 + (index % 5) * 0.12,
                      repeat: Infinity,
                      repeatType: "mirror",
                      ease: "easeInOut",
                      delay: (index % 6) * 0.06,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/45 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                <span>Preview & Hook Zones</span>
                <span className="text-[11px] text-purple-200">00:00-00:28</span>
              </div>
              <div className="relative h-28 overflow-hidden rounded-xl border border-white/10 bg-slate-950/80">
                <motion.div
                  className="absolute inset-y-3 left-[8%] w-[35%] rounded-lg border border-purple-300/60 bg-purple-500/10"
                  animate={{
                    opacity: inHookPhase ? [0.4, 0.95, 0.45] : 0.24,
                    boxShadow: inHookPhase
                      ? [
                          "0 0 0 rgba(192,132,252,0.0)",
                          "0 0 28px rgba(192,132,252,0.55)",
                          "0 0 0 rgba(192,132,252,0.0)",
                        ]
                      : "0 0 0 rgba(192,132,252,0.0)",
                  }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                />

                {inHookPhase ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute left-[10%] top-2 rounded-full border border-purple-200/45 bg-[#130b1f]/85 px-3 py-1 text-[10px] font-medium text-purple-100"
                  >
                    Strongest 3s Hook - 92% Predicted Retention
                  </motion.div>
                ) : null}

                {inPacingPhase ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-[8%] top-2 rounded-full border border-fuchsia-200/40 bg-[#1b0d26]/85 px-3 py-1 text-[10px] font-medium text-fuchsia-100"
                  >
                    Micro-Hook Added
                  </motion.div>
                ) : null}

                <div className="absolute inset-x-0 bottom-0 flex h-10 items-end gap-1 px-2 pb-2">
                  {Array.from({ length: 20 }).map((_, index) => (
                    <motion.div
                      key={index}
                      className="flex-1 rounded-full bg-gradient-to-t from-fuchsia-500/30 to-purple-200/70"
                      animate={{ height: [3, 5 + ((index * 5) % 14), 4] }}
                      transition={{
                        duration: 1.2 + (index % 4) * 0.16,
                        repeat: Infinity,
                        repeatType: "mirror",
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/45 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <Scissors className="h-3.5 w-3.5 text-purple-200" />
                  Adaptive Timeline
                </span>
                <span className="text-[11px] text-fuchsia-100">
                  {inPacingPhase ? "Auto-cutting drop zones" : "Ready"}
                </span>
              </div>
              <div className="relative h-12 overflow-hidden rounded-xl border border-white/10 bg-slate-950/75 p-2">
                <div className="flex h-full gap-1.5">
                  <div className="h-full w-[23%] rounded-lg bg-gradient-to-r from-fuchsia-400/60 to-purple-300/70" />
                  <motion.div
                    className="h-full w-[14%] rounded-lg bg-red-500/45"
                    animate={{ opacity: inPacingPhase ? [0.8, 0.15, 0.08] : 0.45, scale: inPacingPhase ? [1, 0.94, 0.88] : 1 }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <div className="h-full w-[24%] rounded-lg bg-gradient-to-r from-purple-400/45 to-fuchsia-300/65" />
                  <motion.div
                    className="h-full w-[11%] rounded-lg bg-red-500/45"
                    animate={{ opacity: inPacingPhase ? [0.7, 0.12, 0.06] : 0.42, scale: inPacingPhase ? [1, 0.95, 0.9] : 1 }}
                    transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                  />
                  <div className="h-full flex-1 rounded-lg bg-gradient-to-r from-fuchsia-400/45 to-purple-300/65" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-black/45 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-200">
            <span className="inline-flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-purple-200" />
              Retention Forecast
            </span>
            <span className="text-[11px] text-slate-300">Before: 48% → After: {retentionAfter}% Avg Retention</span>
          </div>
          <svg viewBox="0 0 320 80" className="h-20 w-full">
            <path d="M0 60 C44 50 82 56 120 52 C162 48 208 54 260 47 C290 44 304 40 320 42" fill="none" stroke="rgba(248,113,113,0.65)" strokeWidth="2.5" strokeDasharray="4 6" />
            <motion.path
              d="M0 58 C44 40 82 44 120 36 C162 30 208 34 260 23 C290 19 304 13 320 11"
              fill="none"
              stroke="url(#retentionGradient)"
              strokeWidth="3.5"
              strokeLinecap="round"
              initial={{ pathLength: 0.08 }}
              animate={{ pathLength: inRetentionPhase ? 1 : 0.22 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
            />
            <defs>
              <linearGradient id="retentionGradient" x1="0" y1="0" x2="320" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#c084fc" />
                <stop offset="0.55" stopColor="#a855f7" />
                <stop offset="1" stopColor="#d946ef" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {DEMO_PHASES.map((phase) => {
            const isActive = elapsed >= phase.start && elapsed < phase.end;
            const isComplete = elapsed >= phase.end;
            return (
              <div
                key={phase.id}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500",
                  isActive
                    ? "bg-gradient-to-r from-purple-400 to-fuchsia-400 shadow-[0_0_16px_rgba(192,132,252,0.5)]"
                    : isComplete
                      ? "bg-purple-300/60"
                      : "bg-white/10",
                )}
              />
            );
          })}
        </div>

        {inFinalPhase ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute inset-0 grid place-items-center rounded-[1.5rem] bg-black/40 p-4"
          >
            <div className="rounded-2xl border border-purple-200/45 bg-[#0d0a18]/88 px-6 py-3 text-center text-sm font-semibold text-purple-50 shadow-[0_0_30px_rgba(192,132,252,0.45)]">
              Open Editor → Maximize Retention
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

