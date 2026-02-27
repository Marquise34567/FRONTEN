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
        className="rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-xs text-slate-100 backdrop-blur-md"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
