import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, ScanFace, Sparkles, TrendingUp, Wand2 } from "lucide-react";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const facialZones = [
  { label: "Face Zone 1", at: "0:24" },
  { label: "Face Zone 2", at: "0:38" },
  { label: "Face Zone 3", at: "1:03" },
  { label: "Face Zone 4", at: "1:28" },
];

const bingeActions = [
  "Added cliffhanger transition at 1:45",
  "Emotional arc pacing applied for binge flow",
  "Re-hook inserted every 45s to prevent drop-offs",
];

const autonomousNotes = [
  "Payoff signal is weak; first 1-3 seconds do not create a strong enough pattern interrupt.",
  "Opener does not show enough visible story content in the first 1-2 seconds.",
  "Hook reveals too much or has weak teaser pressure; ending resolves too cleanly.",
  "Full-video opener scan complete; candidate won section 3/8 and advanced to global faceoff.",
  "Adaptive hook weights used from 24 feedback samples.",
];

const EditorAMode = () => {
  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main min-h-screen px-4 pb-20 pt-24">
        <motion.header
          className="mx-auto max-w-6xl space-y-3"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Link
            to="/editor"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to editor
          </Link>
          <div className="rounded-2xl border border-primary/30 bg-background/65 p-5 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge className="border-primary/35 bg-primary/10 text-foreground">A-Mode</Badge>
              <Badge className="border-border/55 bg-background/55 text-foreground">Self-directed · Learning live</Badge>
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">A-Mode Intelligence Deck</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Modern retention automation with facial and emotion intelligence, now separated from the main editor flow.
            </p>
          </div>
        </motion.header>

        <motion.section
          className="mx-auto mt-6 grid max-w-6xl gap-4 lg:grid-cols-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
        >
          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <ScanFace className="h-3.5 w-3.5 text-primary" />
                Facial Scan Overlay
              </p>
              <Badge className="border-primary/35 bg-primary/10 text-foreground">+15%</Badge>
            </div>
            <p className="mt-2 text-sm text-foreground/90">
              Focus lock near 0:24 estimated to lift retention by +15%.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {facialZones.map((zone) => (
                <div key={zone.label} className="rounded-lg border border-border/60 bg-background/60 p-2 text-[11px] text-muted-foreground">
                  {zone.label} · {zone.at}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Binge Mode
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Curiosity loops, cliffhangers, emotional arcs, dynamic pacing, and re-hooks.
            </p>
            <div className="mt-3 space-y-2">
              {bingeActions.map((line) => (
                <div key={line} className="rounded-lg border border-border/60 bg-background/60 p-2 text-xs text-foreground/90">
                  {line}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                Retention + Emotion Analysis
              </p>
              <Badge className="border-warning/35 bg-warning/10 text-warning">50% predicted</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Top emotion: tension</p>
            <div className="mt-3 rounded-lg border border-border/60 bg-background/60 p-2 text-xs text-muted-foreground">
              Goal line: 70%+ · Tune with A-Mode suggestions · Click graph for deep dive
            </div>
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Wand2 className="h-3.5 w-3.5 text-primary" />
                Autonomous Editor
              </p>
              <Badge className="border-emerald-400/35 bg-emerald-400/10 text-emerald-100">Quality gate: Passed (7/7)</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Self-running hook, cut, pacing, and story decisions built from transcript, audio, visual, emotion, and reward signals.
            </p>
            <div className="mt-3 rounded-lg border border-border/60 bg-background/60 p-2 text-xs text-foreground/90">
              Hook Decision: Auto moved to opening 00:00.000 - 00:05.000 (source 02:15.010 - 02:20.010)
            </div>
            <div className="mt-2 rounded-lg border border-border/60 bg-background/60 p-2 text-xs text-foreground/90">
              Cut quality: 56% · Boundary critic retrained on Mar 10, 9:13 AM
            </div>
            <div className="mt-3 space-y-2">
              {autonomousNotes.map((note) => (
                <p key={note} className="text-xs text-muted-foreground">
                  {note}
                </p>
              ))}
            </div>
          </article>
        </motion.section>

        <div className="mx-auto mt-6 flex max-w-6xl justify-end">
          <Button asChild>
            <Link to="/editor">Return to Editor</Link>
          </Button>
        </div>
      </main>
    </GlowBackdrop>
  );
};

export default EditorAMode;
