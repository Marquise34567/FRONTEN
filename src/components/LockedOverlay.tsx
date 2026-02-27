import { Lock } from "lucide-react";

const LockedOverlay = ({ label = "Premium" }: { label?: string }) => {
  return (
    <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-[rgba(212,175,55,0.22)] via-[rgba(212,175,55,0.08)] to-transparent backdrop-blur-sm flex items-center justify-center">
      <div className="flex items-center gap-2 rounded-full border border-[rgba(212,175,55,0.45)] bg-background/80 px-3 py-1 text-xs font-semibold text-[#f6da8a] shadow">
        <Lock className="w-3 h-3" />
        {label}
      </div>
    </div>
  );
};

export default LockedOverlay;
