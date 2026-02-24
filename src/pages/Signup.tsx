import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowRight, Lock } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/hooks/use-toast";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password || !confirm) return;
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters." });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords do not match", description: "Please re-enter your password." });
      return;
    }
    setSubmitting(true);
    const result = await signUp(normalizedEmail, password);
    setSubmitting(false);
    if (result.error) {
      toast({ title: "Sign up failed", description: result.error });
      return;
    }
    if (result.needsEmailConfirm) {
      setEmailSent(true);
      return;
    }
    navigate("/editor");
  };

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main flex items-center justify-center min-h-screen px-4 pt-24">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="glass-card p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold font-display text-foreground mb-2">Create your account</h1>
              <p className="text-sm text-muted-foreground">Start editing with AutoEditor</p>
            </div>

            {emailSent ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <h2 className="font-semibold text-foreground mb-2">Check your email</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a confirmation link to <strong className="text-foreground">{email}</strong>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm text-muted-foreground">Email address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-muted/50 border-border/50 focus:border-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-muted/50 border-border/50 focus:border-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm" className="text-sm text-muted-foreground">Confirm password</Label>
                  <Input
                    id="confirm"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Re-enter password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="bg-muted/50 border-border/50 focus:border-primary/50"
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full rounded-lg gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                  {submitting ? "Creating account..." : "Create account"}
                  {submitting ? <Lock className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </Button>
              </form>
            )}
          </div>
        </motion.div>
      </main>
    </GlowBackdrop>
  );
};

export default Signup;
