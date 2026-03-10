import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import SeoHead from "@/components/SeoHead";

const HOW_IT_WORKS_SEO_DESCRIPTION =
  "Learn how AutoEditor processes footage end to end: upload, hook detection, pacing optimization, caption styling, render, and final export review.";
const HOW_IT_WORKS_SEO_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How AutoEditor Works",
  "description": HOW_IT_WORKS_SEO_DESCRIPTION,
  "url": "https://www.autoeditor.app/how-editor-works",
  "step": [
    { "@type": "HowToStep", "name": "Upload source footage" },
    { "@type": "HowToStep", "name": "Choose format and pipeline" },
    { "@type": "HowToStep", "name": "Configure captions and style controls" },
    { "@type": "HowToStep", "name": "Run AI analysis and hook selection" },
    { "@type": "HowToStep", "name": "Render and review export output" },
  ],
};

const HowEditorWorks = () => {
  return (
    <GlowBackdrop>
      <SeoHead
        title="How AutoEditor Works: AI Editing Pipeline Explained"
        description={HOW_IT_WORKS_SEO_DESCRIPTION}
        path="/how-editor-works"
        jsonLd={HOW_IT_WORKS_SEO_JSON_LD}
      />
      <Navbar />
      <main className="responsive-main min-h-screen px-4 pb-20 pt-24">
        <motion.div
          className="mx-auto mb-10 max-w-3xl text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">How The Editor Works</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: March 3, 2026</p>
        </motion.div>

        <motion.div
          className="mx-auto max-w-3xl space-y-8 rounded-2xl border border-border/50 bg-card/50 p-6 sm:p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.45 }}
        >
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. Start A New Project</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Click <span className="font-medium text-foreground">New Project</span> and upload your source file.
              MP4, M4V, and MKV are supported in the main flow.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2. Pick Format And Pipeline</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Choose horizontal or vertical output, then select a retention profile and platform target.
              The pipeline mode controls how aggressive and exploratory the edit engine becomes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. Set Style Controls</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Configure captions, cut count, and optional style controls like editor mode. Editor mode is optional:
              if you leave it on <span className="font-medium text-foreground">Auto</span>, the system infers style
              from your footage.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">4. Analyze + Hook Selection</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The analyzer scans transcript, pacing, and visual cues, then ranks high-retention windows. The hook
              phase chooses the opening beat designed to minimize early drop-off.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">5. Cut, Pace, And Stabilize Continuity</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The editor removes low-value sections, compresses dead air, and tunes rhythm based on your settings.
              Continuity checks then protect against abrupt transitions and context loss.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">6. Captions, Audio, And Output Polish</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Captions are generated and styled, audio is normalized, and final formatting is prepared for your chosen
              destination format.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">7. Render And Review</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Once rendering finishes, job status moves to <span className="font-medium text-foreground">Ready</span>.
              Open export files, preview the result, and download your final video.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">8. Improve Future Outputs</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Optional platform syncing and outcome feedback can refine future recommendations and mode defaults for
              your account over time.
            </p>
          </section>
        </motion.div>

        <div className="mx-auto mt-8 max-w-3xl text-center">
          <Link to="/" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Back to landing page
          </Link>
        </div>
      </main>
    </GlowBackdrop>
  );
};

export default HowEditorWorks;
