import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, SlidersHorizontal, Captions, Sparkles, Smartphone } from "lucide-react";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const VerticalExtras = () => {
  const [searchParams] = useSearchParams();

  const compactEditorHref = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.set("mode", "vertical");
    next.delete("verticalExtras");
    const query = next.toString();
    return query ? `/editor?${query}` : "/editor?mode=vertical";
  }, [searchParams]);

  const fullEditorHref = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.set("mode", "vertical");
    next.set("verticalExtras", "1");
    const query = next.toString();
    return query ? `/editor?${query}` : "/editor?mode=vertical&verticalExtras=1";
  }, [searchParams]);

  const aModeHref = useMemo(() => {
    const next = new URLSearchParams();
    const jobId = String(searchParams.get("jobId") || "").trim();
    if (jobId) next.set("jobId", jobId);
    const query = next.toString();
    return query ? `/editor/a-mode?${query}` : "/editor/a-mode";
  }, [searchParams]);

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main mx-auto min-h-screen max-w-5xl px-4 pb-16 pt-24">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="rounded-2xl border border-primary/35 bg-[linear-gradient(145deg,rgba(12,21,45,0.9),rgba(5,10,24,0.9))] p-5"
        >
          <Link
            to={compactEditorHref}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to compact vertical mode
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className="border-primary/40 bg-primary/15 text-primary">Vertical Extras</Badge>
            <Badge variant="outline" className="border-border/60 bg-background/45 text-muted-foreground">
              Components page
            </Badge>
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl">
            Advanced Vertical Components
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-foreground/85">
            Compact mode keeps the editor lightweight. Use this page to jump into advanced layout controls,
            caption tuning, and agent-heavy tools when needed.
          </p>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.3 }}
          className="mt-5 grid gap-3 sm:grid-cols-2"
        >
          <article className="rounded-xl border border-border/60 bg-background/55 p-4">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5 text-primary" />
              Full Vertical Workspace
            </p>
            <p className="mt-2 text-sm text-foreground/90">
              Open the full editor with advanced setup cards and expanded controls.
            </p>
            <div className="mt-3">
              <Button asChild className="min-h-10 rounded-xl">
                <Link to={fullEditorHref}>Open full workspace</Link>
              </Button>
            </div>
          </article>

          <article className="rounded-xl border border-border/60 bg-background/55 p-4">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
              Compact Workspace
            </p>
            <p className="mt-2 text-sm text-foreground/90">
              Return to the compact command deck for quick upload, render, and export flow.
            </p>
            <div className="mt-3">
              <Button asChild variant="outline" className="min-h-10 rounded-xl">
                <Link to={compactEditorHref}>Back to compact mode</Link>
              </Button>
            </div>
          </article>

          <article className="rounded-xl border border-border/60 bg-background/55 p-4">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
              <Captions className="h-3.5 w-3.5 text-primary" />
              Caption Studio
            </p>
            <p className="mt-2 text-sm text-foreground/90">
              Use the compact editor and open Caption Studio from the gallery cards for per-clip caption tuning.
            </p>
            <div className="mt-3">
              <Button asChild variant="outline" className="min-h-10 rounded-xl">
                <Link to={compactEditorHref}>Open compact + captions</Link>
              </Button>
            </div>
          </article>

          <article className="rounded-xl border border-border/60 bg-background/55 p-4">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Agent Components
            </p>
            <p className="mt-2 text-sm text-foreground/90">
              Open A-Mode for richer rate-card and story-map intelligence components.
            </p>
            <div className="mt-3">
              <Button asChild variant="outline" className="min-h-10 rounded-xl">
                <Link to={aModeHref}>Open A-Mode deck</Link>
              </Button>
            </div>
          </article>
        </motion.section>
      </main>
    </GlowBackdrop>
  );
};

export default VerticalExtras;

