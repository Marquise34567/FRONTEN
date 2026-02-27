import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type MetallicProgressProps = {
  value: number;
  className?: string;
};

export default function MetallicProgress({ value, className }: MetallicProgressProps) {
  return (
    <Progress
      value={value}
      className={cn("metallic-progress-track h-2.5", className)}
      indicatorClassName="metallic-progress-fill"
    />
  );
}
