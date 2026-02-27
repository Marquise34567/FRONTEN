import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const buttonVariants = cva(
  "btn-glow inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_28px_-10px_hsl(var(--primary)/0.9)]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:border-primary/45 hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-[0_0_20px_-12px_hsl(var(--primary)/0.7)]",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-[var(--ae-btn-h,2.5rem)] px-[var(--ae-btn-px,1rem)] py-2 text-[length:var(--ae-btn-text,0.875rem)]",
        sm: "h-[var(--ae-btn-h-sm,2.25rem)] rounded-md px-[var(--ae-btn-px-sm,0.75rem)] text-[length:var(--ae-btn-text-sm,0.8125rem)]",
        lg: "h-[var(--ae-btn-h-lg,2.75rem)] rounded-md px-[var(--ae-btn-px-lg,2rem)] text-[length:var(--ae-btn-text-lg,0.95rem)]",
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
