import { motion } from "framer-motion";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

const BillingSuccess = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
    queryClient.invalidateQueries({ queryKey: ["me"] });
  }, [queryClient]);

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main min-h-screen flex items-center justify-center px-4 pt-24 pb-12">
        <motion.div
          className="glass-card p-8 max-w-md text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground mb-2">Subscription active</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your plan is now active. You can start exporting right away.
          </p>
          <Link to="/editor">
            <Button className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground w-full">
              Go to Editor
            </Button>
          </Link>
        </motion.div>
      </main>
    </GlowBackdrop>
  );
};

export default BillingSuccess;
