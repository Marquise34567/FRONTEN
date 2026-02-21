import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Play, Download, RefreshCw, ArrowLeft, Sparkles, Scissors,
  Clock, Volume2, Eye, FileJson, Film, Lock,
} from "lucide-react";

const mockSegments = [
  { start: 0, end: 4.5, reason: "Hook — highest engagement score", score: 0.92, kept: true },
  { start: 12, end: 22, reason: "Strong speech + high motion", score: 0.78, kept: true },
  { start: 22, end: 27, reason: "Low energy pause", score: 0.21, kept: false },
  { start: 27, end: 35, reason: "Active demonstration", score: 0.74, kept: true },
  { start: 35, end: 41, reason: "Silence + no faces", score: 0.15, kept: false },
  { start: 41, end: 52, reason: "Key explanation segment", score: 0.81, kept: true },
  { start: 52, end: 58, reason: "Repetitive visuals", score: 0.19, kept: false },
  { start: 58, end: 68, reason: "Strong conclusion + CTA", score: 0.85, kept: true },
];

const JobDetail = () => {
  const { id } = useParams();
  const [useHook, setUseHook] = useState(true);
  const [pacing, setPacing] = useState([50]);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  const handleRender = () => {
    setRendering(true);
    setRenderProgress(0);
    const interval = setInterval(() => {
      setRenderProgress((p) => {
        if (p >= 100) { clearInterval(interval); setRendering(false); return 100; }
        return p + 2;
      });
    }, 100);
  };

  const pacingLabel = pacing[0] < 33 ? "Calm" : pacing[0] < 66 ? "Normal" : "Fast";

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="min-h-screen px-4 pt-24 pb-12 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Link to="/app" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>

          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold font-display text-foreground">gaming-highlights.mp4</h1>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">gaming</Badge>
                <span className="text-xs text-muted-foreground">confidence: 87%</span>
              </div>
              <p className="text-sm text-muted-foreground">Job #{id} · Created 2 hours ago</p>
            </div>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <RefreshCw className="w-4 h-4" /> Re-run Analysis
              <Lock className="w-3 h-3 text-primary" />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Preview + Controls */}
            <div className="lg:col-span-2 space-y-6">
              {/* Hook Preview */}
              <div className="glass-card overflow-hidden">
                <div className="aspect-video bg-muted/30 flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                  <Button size="lg" variant="ghost" className="relative z-10 w-16 h-16 rounded-full bg-primary/20 hover:bg-primary/30 text-primary">
                    <Play className="w-8 h-8 ml-1" />
                  </Button>
                  <div className="absolute bottom-4 left-4 z-10">
                    <span className="pill-badge text-[10px]">
                      <Sparkles className="w-3 h-3" /> Hook Preview (0:00 – 0:04.5)
                    </span>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="glass-card p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Use detected hook</span>
                  </div>
                  <Switch checked={useHook} onCheckedChange={setUseHook} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Pacing</span>
                    <span className="text-xs text-muted-foreground">{pacingLabel}</span>
                  </div>
                  <Slider value={pacing} onValueChange={setPacing} max={100} step={1} className="[&>span>span]:bg-primary" />
                  <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                    <span>Calm</span><span>Normal</span><span>Fast</span>
                  </div>
                </div>

                {rendering ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Rendering...</span>
                      <span className="text-xs text-muted-foreground">{renderProgress}%</span>
                    </div>
                    <Progress value={renderProgress} className="h-2 bg-muted [&>div]:bg-primary" />
                  </div>
                ) : (
                  <Button onClick={handleRender} className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg">
                    <Film className="w-4 h-4" /> Render Final Video
                  </Button>
                )}

                {renderProgress === 100 && (
                  <motion.div
                    className="grid grid-cols-2 gap-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Button variant="secondary" size="sm" className="gap-2 rounded-lg">
                      <Download className="w-3.5 h-3.5" /> Final MP4
                    </Button>
                    <Button variant="secondary" size="sm" className="gap-2 rounded-lg">
                      <Download className="w-3.5 h-3.5" /> Preview MP4
                    </Button>
                    <Button variant="secondary" size="sm" className="gap-2 rounded-lg">
                      <FileJson className="w-3.5 h-3.5" /> Edit Plan
                    </Button>
                    <Button variant="secondary" size="sm" className="gap-2 rounded-lg">
                      <Download className="w-3.5 h-3.5" /> Captions
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Right: Timeline / Segments */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold font-display text-foreground flex items-center gap-2">
                <Scissors className="w-4 h-4 text-primary" /> Edit Plan Timeline
              </h3>
              <div className="space-y-2">
                {mockSegments.map((seg, i) => (
                  <motion.div
                    key={i}
                    className={`glass-card p-3 text-xs ${seg.kept ? "" : "opacity-50"}`}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: seg.kept ? 1 : 0.5, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {seg.kept ? (
                          <Eye className="w-3 h-3 text-success" />
                        ) : (
                          <Scissors className="w-3 h-3 text-destructive" />
                        )}
                        <span className="font-medium text-foreground">
                          {formatTime(seg.start)} – {formatTime(seg.end)}
                        </span>
                      </div>
                      <span className="text-muted-foreground">{(seg.score * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-muted-foreground flex items-center gap-1">
                      {seg.kept ? <Volume2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {seg.reason}
                    </p>
                  </motion.div>
                ))}
              </div>

              <div className="glass-card p-4 space-y-2">
                <h4 className="text-xs font-semibold text-foreground">Pacing Metrics</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Avg Segment:</span> <span className="text-foreground">8.2s</span></div>
                  <div><span className="text-muted-foreground">Cut Freq:</span> <span className="text-foreground">6.8/min</span></div>
                  <div><span className="text-muted-foreground">Boring Cut:</span> <span className="text-foreground">18s</span></div>
                  <div><span className="text-muted-foreground">Final Len:</span> <span className="text-foreground">0:42</span></div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </GlowBackdrop>
  );
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default JobDetail;
