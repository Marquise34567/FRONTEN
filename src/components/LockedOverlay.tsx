import { Lock } from "lucide-react";

const LockedOverlay = ({ label = "Premium" }: { label?: string }) => {
  return (
    <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/25 via-primary/10 to-transparent backdrop-blur-sm flex items-center justify-center">
      <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-background/80 px-3 py-1 text-xs font-semibold text-primary shadow">
        <Lock className="w-3 h-3" />
        {label}
      </div>
    </div>
  );
};

export default LockedOverlay;
