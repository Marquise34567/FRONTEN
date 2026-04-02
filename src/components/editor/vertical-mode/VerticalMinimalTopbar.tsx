import { Cpu, PanelRightOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type VerticalMinimalTopbarProps = {
  statusLabel: string;
  presetLabel: string;
  clipCounterLabel: string;
  progressLabel: string;
  accelerationLabel: string;
  onOpenExtras: () => void;
};

export function VerticalMinimalTopbar({
  statusLabel,
  presetLabel,
  clipCounterLabel,
  progressLabel,
  accelerationLabel,
  onOpenExtras,
}: VerticalMinimalTopbarProps) {
  return (
    <header className="vertical-opus-min-topbar">
      <div className="vertical-opus-min-topbar-brand">
        <div className="vertical-opus-min-topbar-brand-glyph" aria-hidden>
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="vertical-opus-min-topbar-brand-copy">
          <p>AutoEditor</p>
          <h2>Vertical Clips</h2>
        </div>
      </div>
      <div className="vertical-opus-min-topbar-center">
        <p>Best moments ranked, clipped, and export-ready.</p>
        <div className="vertical-opus-min-topbar-subchips" aria-label="Vertical mode pipeline locks">
          <span className="vertical-opus-min-subchip">Best moments only</span>
          <span className="vertical-opus-min-subchip">Webcam at top</span>
          <span className="vertical-opus-min-subchip">Animated text on</span>
        </div>
      </div>
      <div className="vertical-opus-min-topbar-actions">
        <Badge className="vertical-opus-min-chip">
          {statusLabel} · {progressLabel}
        </Badge>
        <Badge className="vertical-opus-min-chip">{clipCounterLabel}</Badge>
        <Badge className="vertical-opus-min-chip">
          <Cpu className="h-3.5 w-3.5" aria-hidden />
          {accelerationLabel}
        </Badge>
        <Badge className="vertical-opus-min-chip">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {presetLabel}
        </Badge>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="vertical-opus-min-topbar-button"
          onClick={onOpenExtras}
        >
          <PanelRightOpen className="h-3.5 w-3.5" aria-hidden />
          Extras
        </Button>
      </div>
    </header>
  );
}
