import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-white/20 bg-muted/70 p-[2px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_10px_24px_-20px_rgba(15,23,42,0.9)] transition-all duration-200 data-[state=checked]:border-[rgba(52,240,208,0.65)] data-[state=checked]:bg-[linear-gradient(135deg,#95fff2_0%,#34f0d0_45%,#c084fc_100%)] data-[state=unchecked]:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-slate-50 shadow-[0_8px_18px_-10px_rgba(15,23,42,0.9),0_0_0_1px_rgba(148,163,184,0.35)] ring-0 transition-[transform,background-color,box-shadow] duration-200 data-[state=checked]:translate-x-5 data-[state=checked]:bg-[#fff7e3] data-[state=checked]:shadow-[0_8px_18px_-10px_rgba(52,240,208,0.78),0_0_0_1px_rgba(255,255,255,0.45)] data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };

