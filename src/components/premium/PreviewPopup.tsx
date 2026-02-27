import { motion } from "framer-motion";
import { PlayCircle } from "lucide-react";

type PreviewPopupProps = {
  open: boolean;
  label: string;
  timestamp: number;
  note?: string;
};

export default function PreviewPopup({ open, label, timestamp, note }: PreviewPopupProps) {
  if (!open) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="pointer-events-none fixed bottom-5 left-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 rounded-3xl border border-white/15 bg-black/75 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-md"
    >
      <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.13em] text-purple-200">
        <PlayCircle className="h-3.5 w-3.5" />
        Live Preview Sync
      </p>
      <p className="mt-1 text-sm font-medium text-slate-100">{label}</p>
      <p className="text-xs text-slate-300">Seeked to {timestamp.toFixed(1)}s{note ? ` • ${note}` : ""}</p>
    </motion.div>
  );
}
