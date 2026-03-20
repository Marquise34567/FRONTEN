import { Bell, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type VerticalMinimalTopbarProps = {
  statusLabel: string;
  presetLabel: string;
  clipCounterLabel: string;
  progressLabel: string;
  onOpenExtras: () => void;
};

export function VerticalMinimalTopbar({
  statusLabel,
  presetLabel,
  clipCounterLabel,
  progressLabel,
  onOpenExtras,
}: VerticalMinimalTopbarProps) {
  return (
    <header className="vertical-minimal-topbar">
      <div className="vertical-minimal-search">
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
        <input
          type="text"
          readOnly
          tabIndex={-1}
          aria-label="Vertical clip search"
          value=""
          placeholder="Search clips, moments, captions..."
        />
      </div>
      <div className="vertical-minimal-topbar-actions">
        <Badge className="vertical-minimal-top-pill">{statusLabel}</Badge>
        <Badge className="vertical-minimal-top-pill">{progressLabel}</Badge>
        <Badge className="vertical-minimal-top-pill">{clipCounterLabel}</Badge>
        <Badge className="vertical-minimal-top-pill">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {presetLabel}
        </Badge>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="vertical-minimal-topbar-button"
          onClick={onOpenExtras}
        >
          Vertical Extras
        </Button>
        <button type="button" className="vertical-minimal-icon-btn" aria-label="Vertical notifications">
          <Bell className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </header>
  );
}

