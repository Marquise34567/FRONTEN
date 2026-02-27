import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-full border text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-border/55 bg-background/35 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-primary/45 hover:bg-primary/12 hover:text-foreground data-[state=on]:border-cyan-300/55 data-[state=on]:bg-[linear-gradient(135deg,#22d3ee_0%,#60a5fa_55%,#a855f7_100%)] data-[state=on]:text-white data-[state=on]:shadow-[0_12px_28px_-18px_rgba(56,189,248,0.75)]",
        outline:
          "border-border/65 bg-background/20 text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-foreground data-[state=on]:border-cyan-300/50 data-[state=on]:bg-cyan-500/18 data-[state=on]:text-cyan-100",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root ref={ref} className={cn(toggleVariants({ variant, size, className }))} {...props} />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
