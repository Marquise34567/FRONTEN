import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const buttonVariants = cva(
  "btn-glow inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(120deg,rgba(47,228,200,0.88),rgba(42,176,255,0.86),rgba(180,119,255,0.78))] text-white shadow-[0_10px_30px_-18px_rgba(42,176,255,0.6)] hover:brightness-110 hover:shadow-[0_14px_32px_-18px_rgba(47,228,200,0.62)]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-white/15 bg-[rgba(255,255,255,0.02)] text-slate-100 hover:border-cyan-200/40 hover:bg-[rgba(47,228,200,0.09)] hover:text-white",
        secondary:
          "border border-white/12 bg-[rgba(255,255,255,0.04)] text-slate-100 hover:border-cyan-200/35 hover:bg-[rgba(255,255,255,0.08)]",
        ghost: "text-slate-300 hover:bg-[rgba(47,228,200,0.08)] hover:text-cyan-100",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-[var(--ae-btn-h,2.5rem)] px-[var(--ae-btn-px,1rem)] py-2 text-[length:var(--ae-btn-text,0.875rem)]",
        sm: "h-[var(--ae-btn-h-sm,2.25rem)] rounded-full px-[var(--ae-btn-px-sm,0.75rem)] text-[length:var(--ae-btn-text-sm,0.8125rem)]",
        lg: "h-[var(--ae-btn-h-lg,2.75rem)] rounded-full px-[var(--ae-btn-px-lg,2rem)] text-[length:var(--ae-btn-text-lg,0.95rem)]",
        icon: "h-[var(--ae-btn-h,2.5rem)] w-[var(--ae-btn-h,2.5rem)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
  successToast?: string;
  errorToast?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingText, successToast, errorToast, onClick, children, disabled, ...props }, ref) => {
    const [pending, setPending] = React.useState(false);
    const isLoading = Boolean(loading || pending);
    const canUseAsChild =
      asChild &&
      React.Children.count(children) === 1 &&
      React.isValidElement(children) &&
      children.type !== React.Fragment;

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (isLoading) {
          event.preventDefault();
          return;
        }
        if (!onClick) return;
        try {
          const result = onClick(event);
          if (result && typeof (result as Promise<unknown>).then === "function") {
            setPending(true);
            Promise.resolve(result)
              .then(() => {
                if (successToast) toast({ title: successToast });
              })
              .catch((err: unknown) => {
                if (errorToast) {
                  toast({
                    title: errorToast,
                    description: err instanceof Error ? err.message : undefined,
                    variant: "destructive",
                  });
                }
              })
              .finally(() => {
                setPending(false);
              });
            return;
          }
          if (successToast) toast({ title: successToast });
        } catch (err) {
          if (errorToast) {
            toast({
              title: errorToast,
              description: err instanceof Error ? err.message : undefined,
              variant: "destructive",
            });
          }
        }
      },
      [errorToast, isLoading, onClick, successToast],
    );

    if (canUseAsChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          onClick={handleClick}
          aria-busy={isLoading}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {isLoading && loadingText ? loadingText : children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
