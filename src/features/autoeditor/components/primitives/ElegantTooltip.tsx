import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ElegantTooltipProps = {
  content: string;
  children: React.ReactNode;
};

export default function ElegantTooltip({ content, children }: ElegantTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        sideOffset={8}
        className="max-w-[220px] rounded-2xl border border-white/10 bg-black/68 px-3 py-2 text-xs text-slate-100 shadow-[0_18px_36px_-22px_rgba(15,23,42,0.95)] backdrop-blur-md"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
