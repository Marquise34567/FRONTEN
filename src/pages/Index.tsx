import { motion } from "framer-motion";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import LandingDemoEditorModal from "@/components/landing/LandingDemoEditorModal";

const Index = () => {
  return (
    <GlowBackdrop>
      <Navbar />
      <main className="flex w-full flex-col items-center px-4 pb-10 pt-20 sm:px-6 sm:pt-24 sm:pb-16 md:min-h-screen md:justify-center lg:pb-20">
        {/* Hero */}
        <motion.div
          className="flex flex-col items-center text-center max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <motion.div
            className="pill-badge mb-5 sm:mb-8"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            PREMIUM AI AUTO-EDITOR
          </motion.div>

          <motion.h1
            className="mb-4 mx-auto max-w-[18ch] text-[clamp(1.72rem,8.2vw,6rem)] font-black font-display leading-[0.9] tracking-[-0.022em] text-foreground drop-shadow-[0_6px_16px_rgba(88,63,196,0.22)] sm:mb-6 sm:max-w-[16ch] sm:leading-[0.92] lg:max-w-[15ch]"
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
            className="max-w-xl mb-7 text-base leading-relaxed text-muted-foreground sm:mb-10 sm:text-lg"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            Upload your raw footage and let AI detect hooks, cut boring parts, match pacing to your niche, and render a polished final cut — automatically.
          </motion.p>

          <motion.div
            className="flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:gap-4"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.6 }}
          >
            <Link to="/editor" className="w-full sm:w-auto">
              <Button size="lg" className="h-11 w-full gap-2 rounded-full bg-primary px-6 text-primary-foreground glow-sm hover:bg-primary/90 sm:h-12 sm:w-auto sm:px-8">
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/pricing" className="w-full sm:w-auto">
              <Button variant="ghost" size="lg" className="h-11 w-full rounded-full px-6 text-muted-foreground hover:text-foreground sm:h-12 sm:w-auto sm:px-8">
                View Pricing
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Demo Card */}
        <motion.div
          className="mt-10 w-full max-w-6xl sm:mt-16 lg:mt-20"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
        >
          <LandingDemoEditorModal />
        </motion.div>
      </main>
    </GlowBackdrop>
  );
};

export default Index;
