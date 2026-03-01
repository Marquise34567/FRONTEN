import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

// Custom PopoverTrigger wrapper:
// If the child element contains the class `open-editor-settings`, we render the
// child directly and intercept clicks to dispatch a global event so the
// settings popup can open instead of the popover.
const PopoverTrigger = (props: any) => {
  const { children, ...rest } = props;
  if (React.isValidElement(children)) {
    const className = String((children.props && children.props.className) || "");
    // Auto-detect explicit class OR a literal 'Open' label on the child button
    const childText = typeof children.props?.children === "string" ? (children.props.children as string) : null;
    if (className.includes("open-editor-settings") || (childText && childText.trim().toLowerCase() === "open")) {
      const child = React.cloneElement(children, {
        ...children.props,
        onClick: (e: any) => {
          try {
            e?.preventDefault?.();
            e?.stopPropagation?.();
          } catch (err) {}
          window.dispatchEvent(new CustomEvent("open-editor-settings"));
          if (typeof children.props.onClick === "function") children.props.onClick(e);
        },
      });
      return child;
    }
  }
  return <PopoverPrimitive.Trigger {...rest}>{children}</PopoverPrimitive.Trigger>;
};

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
