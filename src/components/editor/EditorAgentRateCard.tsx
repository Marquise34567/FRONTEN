import { memo } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Gauge, Flame, Zap, CheckCircle2, Plus } from "lucide-react";

type RateCardPlatform = "youtube" | "tiktok" | "instagram_reels";

type PlatformRateScoreEntry = {
  platform: RateCardPlatform;
  label: string;
  score: number;
  note: string;
};

type PlatformRateScores = {
  overallScore: number | null;
  topEntry: PlatformRateScoreEntry | null;
  scoreByPlatform: Record<RateCardPlatform, number>;
  averageScore: number;
  entries: PlatformRateScoreEntry[];
};

type EditorRateSuggestionItem = {
  id: string;
  title: string;
  detail: string;
  predictedLift: Partial<Record<RateCardPlatform, number>>;
};

type EditorAgentRateCardProps = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
  platformRateUpdatedLabel: string;
  selectedRateSuggestionCount: number;
  platformRateCardEnabled: boolean;
  onTogglePlatformRateCard: (enabled: boolean) => void;
  dopamineRateActive: boolean;
  reducedMotion: boolean;
  activeJobId: string | null;
  platformRateScores: PlatformRateScores;
  platformRateDecisionReady: boolean;
  editorRateSuggestions: EditorRateSuggestionItem[];
  selectedRateSuggestionIdSet: Set<string>;
  rateCardPlatformLabel: Record<RateCardPlatform, string>;
  onApplySuggestion: (suggestion: EditorRateSuggestionItem) => void;
};

const RATE_CARD_PLATFORMS: RateCardPlatform[] = ["youtube", "tiktok", "instagram_reels"];

const EditorAgentRateCardComponent = ({
  title = "Editor Agent Rate Card",
  subtitle = "Realtime prediction for YouTube, TikTok, and IG Reels. Add agent suggestions to boost scores instantly.",
  compact = false,
  className = "",
  platformRateUpdatedLabel,
  selectedRateSuggestionCount,
  platformRateCardEnabled,
  onTogglePlatformRateCard,
  dopamineRateActive,
  reducedMotion,
  activeJobId,
  platformRateScores,
  platformRateDecisionReady,
  editorRateSuggestions,
  selectedRateSuggestionIdSet,
  rateCardPlatformLabel,
  onApplySuggestion,
}: EditorAgentRateCardProps) => {
  const shellClassName = compact
    ? `rounded-xl border border-primary/35 bg-[linear-gradient(145deg,rgba(28,34,62,0.72),rgba(12,18,38,0.68))] p-3 shadow-[0_18px_34px_-28px_hsl(var(--primary)/0.95)] ${className}`.trim()
    : `retention-summary-card glass-card rounded-xl border border-primary/25 bg-[linear-gradient(150deg,rgba(32,36,72,0.62),rgba(16,20,44,0.72))] p-3 ${className}`.trim();

  return (
    <div className={shellClassName}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
          <p className="mt-1 text-xs text-foreground/85">{subtitle}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Live update {platformRateUpdatedLabel} · {selectedRateSuggestionCount} selected opinion{selectedRateSuggestionCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-primary/35 bg-primary/10 text-primary">
            <Gauge className="mr-1 h-3.5 w-3.5" />
            Agent live
          </Badge>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-background/45 px-2.5 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
              {platformRateCardEnabled ? "ON" : "OFF"}
            </span>
            <Switch
              checked={platformRateCardEnabled}
              onCheckedChange={onTogglePlatformRateCard}
              className="data-[state=checked]:bg-primary"
              aria-label="Toggle editor agent rate card"
            />
          </div>
        </div>
      </div>

      {!platformRateCardEnabled ? (
        <p className="mt-3 rounded-lg border border-dashed border-border/60 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
          Rate card is paused. Toggle ON to resume live platform scoring and suggestions.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-background/45 p-3">
              {dopamineRateActive ? (
                <motion.div
                  className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-300/25 blur-2xl"
                  animate={
                    reducedMotion
                      ? { opacity: 0.6 }
                      : { opacity: [0.35, 0.9, 0.35], scale: [1, 1.24, 1] }
                  }
                  transition={
                    reducedMotion
                      ? { duration: 0.2 }
                      : { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                  }
                />
              ) : null}
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {platformRateDecisionReady ? "Best platform score" : "Platform scores (pending final render)"}
              </p>
              <div className="mt-2 flex items-end gap-2">
                <motion.p
                  key={`${activeJobId || "none"}-${platformRateScores.overallScore ?? "pending"}`}
                  initial={{ opacity: 0.4, y: 6 }}
                  animate={
                    dopamineRateActive && !reducedMotion
                      ? { opacity: 1, y: 0, scale: [1, 1.09, 1] }
                      : { opacity: 1, y: 0, scale: 1 }
                  }
                  transition={
                    dopamineRateActive && !reducedMotion
                      ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.22, ease: "easeOut" }
                  }
                  className={`font-display text-5xl font-bold leading-none tabular-nums ${
                    dopamineRateActive
                      ? "bg-gradient-to-r from-emerald-200 via-white to-cyan-200 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(52,211,153,0.55)]"
                      : "text-foreground"
                  }`}
                >
                  {platformRateScores.overallScore ?? "--"}
                </motion.p>
                <span className="pb-1 text-sm text-muted-foreground">
                  {platformRateDecisionReady ? "/100" : "pending"}
                </span>
              </div>
              <p className="mt-1 text-xs text-foreground/90">
                {platformRateDecisionReady && platformRateScores.topEntry
                  ? `${platformRateScores.topEntry.label} score: ${platformRateScores.topEntry.score}/100.`
                  : "Winner is locked only after render status is ready."}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                YouTube score: {platformRateScores.scoreByPlatform.youtube}/100 · TikTok score: {platformRateScores.scoreByPlatform.tiktok}/100 · IG Reels score: {platformRateScores.scoreByPlatform.instagram_reels}/100.
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Average cross-platform score {platformRateScores.averageScore}/100
                {platformRateDecisionReady ? "." : " (live estimate)."}
              </p>
              {dopamineRateActive ? (
                <Badge className="mt-2 border-emerald-400/45 bg-emerald-500/12 text-emerald-100">
                  <Flame className="mr-1 h-3.5 w-3.5" />
                  High-score momentum unlocked
                </Badge>
              ) : null}
            </div>

            <div className="space-y-2">
              {platformRateScores.entries.map((entry) => {
                const barClassName = entry.platform === "youtube"
                  ? "from-rose-300/80 to-red-400/80"
                  : entry.platform === "tiktok"
                    ? "from-cyan-300/80 to-blue-400/80"
                    : "from-fuchsia-300/80 to-pink-400/80";
                return (
                  <div key={`rate-platform-${entry.platform}`} className="rounded-lg border border-border/55 bg-background/45 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{entry.label}</p>
                      <Badge className="border-primary/35 bg-primary/10 text-foreground">{entry.score}</Badge>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted/65">
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${barClassName}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${entry.score}%` }}
                        transition={{ duration: 0.32, ease: "easeOut" }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{entry.note}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-primary/25 bg-background/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                Realtime changes to increase score
              </p>
              <Badge className="border-primary/35 bg-primary/10 text-primary">
                <Zap className="mr-1 h-3.5 w-3.5" />
                Editor agent suggestions
              </Badge>
            </div>
            <div className="mt-2 space-y-2">
              {editorRateSuggestions.length > 0 ? (
                editorRateSuggestions.map((suggestion) => {
                  const applied = selectedRateSuggestionIdSet.has(suggestion.id);
                  const liftSummary = RATE_CARD_PLATFORMS
                    .map((platform) => {
                      const amount = Number(suggestion.predictedLift[platform] || 0);
                      if (amount <= 0) return "";
                      return `${rateCardPlatformLabel[platform]} +${amount}`;
                    })
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div
                      key={suggestion.id}
                      className={`rounded-lg border p-2.5 ${
                        applied
                          ? "border-emerald-400/35 bg-emerald-500/10"
                          : "border-border/60 bg-background/45"
                      }`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">{suggestion.title}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{suggestion.detail}</p>
                          {liftSummary ? (
                            <p className="mt-1 text-[11px] text-foreground/85">{liftSummary}</p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={applied ? "default" : "outline"}
                          className="h-8 min-w-24 px-2 text-[11px]"
                          disabled={applied}
                          onClick={() => onApplySuggestion(suggestion)}
                        >
                          {applied ? (
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          ) : (
                            <Plus className="mr-1 h-3.5 w-3.5" />
                          )}
                          {applied ? "Added" : "Add live"}
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-lg border border-border/55 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                  No extra changes needed right now. The current configuration is already optimized for this timeline.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const EditorAgentRateCard = memo(EditorAgentRateCardComponent);
