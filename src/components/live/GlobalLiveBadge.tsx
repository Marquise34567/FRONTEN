import { Activity, ArrowUpRight, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/providers/AuthProvider";
import { useLiveStats } from "@/providers/LiveStatsProvider";

const DEV_LIVE_FEED_EMAIL = "fyequise03@gmail.com";

const formatCompact = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number.isFinite(value) ? value : 0
  );

const GlobalLiveBadge = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { snapshot, pulse, connected, transport } = useLiveStats();
  const currentEmail = String(user?.email || "").trim().toLowerCase();
  const canSeeDevLiveFeedOverlay = currentEmail === DEV_LIVE_FEED_EMAIL;
  const activeUsers = pulse?.activeUsers ?? snapshot?.activeUsers ?? 0;
  const upgradedToday = pulse?.upgradedToday ?? snapshot?.upgradeSignals?.upgradedToday ?? 0;

  if (!canSeeDevLiveFeedOverlay || (!snapshot && !pulse)) return null;

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-40 sm:bottom-4 sm:right-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            type="button"
            onClick={() => navigate("/control-panel")}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.99 }}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-purple-300/35 bg-[#101225]/85 px-3 py-2 text-xs text-slate-100 shadow-[0_10px_35px_-15px_rgba(168,85,247,0.9)] backdrop-blur-xl transition hover:border-purple-200/50"
          >
            <span className={`inline-flex h-2 w-2 rounded-full ${connected ? "bg-emerald-300" : "bg-amber-300"}`} />
            <Users className="h-3.5 w-3.5 text-purple-200" />
            <span>{formatCompact(activeUsers)} active</span>
            <Activity className="h-3.5 w-3.5 text-cyan-200" />
            <span>{formatCompact(upgradedToday)} upgrades</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-purple-100/80" />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs border-purple-300/30 bg-[#121426] text-slate-100">
          Live feed transport: <span className="font-semibold uppercase tracking-wide">{transport}</span>. Click to open Real-Time Control Panel.
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default GlobalLiveBadge;
