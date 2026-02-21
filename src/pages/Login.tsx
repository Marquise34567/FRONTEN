import { useState } from "react";
import { motion } from "framer-motion";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowRight } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="flex items-center justify-center min-h-screen px-4 pt-24">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="glass-card p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold font-display text-foreground mb-2">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Sign in to your AutoEditor account</p>
            </div>

            {sent ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <h2 className="font-semibold text-foreground mb-2">Check your email</h2>
                <p className="text-sm text-muted-foreground">We sent a magic link to <strong className="text-foreground">{email}</strong></p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm text-muted-foreground">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-muted/50 border-border/50 focus:border-primary/50"
                  />
                </div>
                <Button type="submit" className="w-full rounded-lg gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                  Continue with Email
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            )}
          </div>
        </motion.div>
      </main>
    </GlowBackdrop>
  );
};

export default Login;
