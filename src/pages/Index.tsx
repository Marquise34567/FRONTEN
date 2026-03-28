import { motion } from "framer-motion";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

const Index = () => {
  return (
    <GlowBackdrop>
      <Navbar />
      <main className="flex flex-col items-center justify-center min-h-screen px-4 pt-24 pb-20">
        {/* Hero */}
        <motion.div
          className="flex flex-col items-center text-center max-w-3xl mx-auto"
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
            className="mb-6 mx-auto max-w-[18ch] text-[clamp(1.62rem,8.4vw,5rem)] font-black font-display leading-[0.9] tracking-[-0.022em] text-foreground drop-shadow-[0_6px_16px_rgba(88,63,196,0.22)] sm:max-w-[16ch] sm:leading-[0.92] lg:max-w-[15ch]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            <span className="block text-balance">YOU VIDEOS DON'T NEED MORE EFFORT</span>
            <span className="mt-1.5 block text-balance text-primary drop-shadow-[0_8px_18px_rgba(110,73,214,0.34)] sm:mt-2">
              THEY NEED SMARTER EDITTING
            </span>
          </motion.h1>

          <motion.p
            className="text-lg text-muted-foreground max-w-xl mb-10 leading-relaxed"
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

        {/* Demo Card */}
        <motion.div
          className="mt-20 w-full max-w-2xl"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
        >
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <span className="font-display font-semibold text-foreground">Auto-Editor</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs text-muted-foreground">Processing</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Video Analysis</span>
                <span className="text-xs text-muted-foreground">68%</span>
              </div>
              <Progress value={68} className="h-2 bg-muted [&>div]:bg-primary" />
              <p className="text-xs text-muted-foreground">Analyzing video for hooks, pacing, and boring segments...</p>
            </div>
          </div>
        </motion.div>
      </main>
    </GlowBackdrop>
  );
};

export default Index;
