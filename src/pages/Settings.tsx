import { motion } from "framer-motion";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Shield, Sparkles } from "lucide-react";

const Settings = () => {
  return (
    <GlowBackdrop>
      <Navbar />
      <main className="min-h-screen px-4 pt-24 pb-12 max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold font-display text-foreground mb-8">Settings</h1>

          {/* Plan */}
          <div className="glass-card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Current Plan</h2>
                  <p className="text-sm text-muted-foreground">Manage your subscription</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">Free</Badge>
            </div>
            <div className="flex items-center gap-3">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg gap-2">
                <CreditCard className="w-4 h-4" /> Upgrade to Premium
              </Button>
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground rounded-lg">
                Manage Billing
              </Button>
            </div>
          </div>

          {/* Usage */}
          <div className="glass-card p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Usage Today</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="glass-card p-4">
                <p className="text-muted-foreground mb-1">Exports Used</p>
                <p className="text-2xl font-bold font-display text-foreground">0 <span className="text-sm font-normal text-muted-foreground">/ 1</span></p>
              </div>
              <div className="glass-card p-4">
                <p className="text-muted-foreground mb-1">Jobs Created</p>
                <p className="text-2xl font-bold font-display text-foreground">3</p>
              </div>
            </div>
          </div>

          {/* Account */}
          <div className="glass-card p-6">
            <h2 className="font-semibold text-foreground mb-4">Account</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="text-foreground">user@example.com</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Member since</span>
                <span className="text-foreground">Feb 2026</span>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </GlowBackdrop>
  );
};

export default Settings;
