import { useState } from "react";
import { motion } from "framer-motion";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Lock } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useNavigate, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const { signIn, resendConfirmation } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setErrorCode(null);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (result.error) {
      setErrorMessage(result.error);
      setErrorCode(result.code ?? null);
      toast({ title: "Login failed", description: result.error });
      return;
    }
    navigate("/editor");
  };

  const canResendConfirmation =
    errorCode === "email_not_confirmed" || errorCode === "provider_email_needs_verification";

  const handleResend = async () => {
    if (!email.trim()) {
      toast({ title: "Email required", description: "Enter your email to resend confirmation." });
      return;
    }
    setResending(true);
    const result = await resendConfirmation(email);
    setResending(false);
    if (result.error) {
      toast({ title: "Resend failed", description: result.error });
      return;
    }
    toast({ title: "Confirmation sent", description: "Check your inbox for the verification link." });
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
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-muted/50 border-border/50 focus:border-primary/50"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {submitting ? "Signing in..." : "Sign in"}
                {submitting ? <Lock className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </Button>
              {errorMessage ? (
                <p className="text-sm text-destructive text-center">{errorMessage}</p>
              ) : null}
              {canResendConfirmation ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={resending}
                  onClick={handleResend}
                  className="w-full"
                >
                  {resending ? "Resending..." : "Resend confirmation email"}
                </Button>
              ) : null}
              <p className="text-xs text-muted-foreground text-center">
                New here?{" "}
                <Link to="/signup" className="text-primary hover:text-primary/80">
                  Create an account
                </Link>
              </p>
            </form>
          </div>
        </motion.div>
      </main>
    </GlowBackdrop>
  );
};

export default Login;
