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
        className="max-w-[220px] rounded-2xl border border-white/15 bg-[#16161b]/92 px-3 py-2 text-xs text-[#f2ebdf] shadow-[0_20px_42px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
