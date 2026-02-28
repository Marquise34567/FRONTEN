import * as React from "react";

import { cn } from "@/lib/utils";

function GoingViral({ className }: { className?: string }) {
  return (
    <div className={cn("going-viral flex items-center justify-center p-6", className)}>
      <svg width="160" height="100" viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <defs>
          <linearGradient id="g" x1="0" x2="1">
            <stop offset="0%" stopColor="#ff7a18" />
            <stop offset="100%" stopColor="#af0" />
          </linearGradient>
        </defs>
        <g transform="translate(80 50)">
          <circle className="ring ring-1" r="18" fill="none" stroke="url(#g)" strokeWidth="3" opacity="0.9" />
          <circle className="ring ring-2" r="26" fill="none" stroke="#ffb86b" strokeWidth="2" opacity="0.7" />
          <g className="center-emoji" transform="translate(-6 -6)">
            <text fontSize="28" y="24">🔥</text>
          </g>
        </g>
        <g className="floaters" transform="translate(0 0)">
          <text className="f1" x="20" y="88" fontSize="14">👍</text>
          <text className="f2" x="140" y="12" fontSize="14">❤️</text>
          <text className="f3" x="10" y="18" fontSize="14">✨</text>
        </g>
      </svg>
      <style>{`
        .going-viral .ring-1 { animation: pulse 1600ms cubic-bezier(.2,.9,.2,1) infinite; }
        .going-viral .ring-2 { animation: pulse 2000ms cubic-bezier(.2,.9,.2,1) 300ms infinite; }
        @keyframes pulse {
          0% { transform: scale(0.6); opacity: 0.9; }
          60% { transform: scale(1.5); opacity: 0.25; }
          100% { transform: scale(2); opacity: 0; }
        }
        .going-viral .center-emoji { animation: pop 800ms ease-out 0ms 1; }
        @keyframes pop { 0% { transform: scale(0.6); } 80% { transform: scale(1.12); } 100% { transform: scale(1); } }
        .going-viral .floaters text { opacity: 0; transform-origin: center; }
        .going-viral .f1 { animation: floatUp 2600ms ease-in-out 0ms infinite; }
        .going-viral .f2 { animation: floatUp 3000ms ease-in-out 400ms infinite; }
        .going-viral .f3 { animation: floatUp 2800ms ease-in-out 700ms infinite; }
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          50% { transform: translateY(-32px) scale(1.05); opacity: 1; }
          100% { transform: translateY(-70px) scale(0.9); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
  const isViral = (props as any)["data-viral"] !== undefined && (props as any)["data-viral"] !== "false";
  if (isViral) {
    return (
      <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden", className)} {...props}>
        <GoingViral />
      </div>
    );
  }
  return <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />;
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
