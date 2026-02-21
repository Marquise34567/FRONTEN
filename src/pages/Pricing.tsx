import { motion } from "framer-motion";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Get started with AI editing",
    features: [
      "1 export per day",
      "Auto hook detection",
      "Boring segment removal",
      "Niche detection",
      "Watermarked output",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "$19",
    period: "/month",
    description: "Unlimited editing power",
    features: [
      "Unlimited exports",
      "No watermark",
      "Re-run analysis",
      "Priority rendering",
      "Caption burn-in",
      "Vertical template + blur",
      "API access",
    ],
    cta: "Upgrade to Premium",
    highlighted: true,
  },
];

const Pricing = () => {
  return (
    <GlowBackdrop>
      <Navbar />
      <main className="min-h-screen px-4 pt-24 pb-20">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold font-display text-foreground mb-4">Simple, transparent pricing</h1>
          <p className="text-muted-foreground">Start free. Upgrade when you need unlimited power.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              className={`glass-card p-8 relative ${plan.highlighted ? "border-primary/30 glow-sm" : ""}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="pill-badge text-[10px]">
                    <Zap className="w-3 h-3" /> MOST POPULAR
                  </span>
                </div>
              )}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  {plan.highlighted ? (
                    <Sparkles className="w-5 h-5 text-primary" />
                  ) : (
                    <div className="w-5 h-5 rounded bg-muted" />
                  )}
                  <h3 className="text-lg font-semibold font-display text-foreground">{plan.name}</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold font-display text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-success shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full rounded-lg ${
                  plan.highlighted
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground glow-sm"
                    : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                }`}
              >
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>
      </main>
    </GlowBackdrop>
  );
};

export default Pricing;
