import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthResult = {
  error?: string;
  code?: string;
  status?: number;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult & { needsEmailConfirm?: boolean }>;
  resendConfirmation: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const toAuthResult = (error?: AuthError | null): AuthResult => {
  if (!error) return {};
  const code = error.code ? String(error.code) : undefined;
  let message = error.message || "Authentication failed.";
  if (code === "invalid_credentials") message = "Email or password is incorrect.";
  if (code === "email_not_confirmed" || code === "provider_email_needs_verification") {
    message = "Please confirm your email before signing in.";
  }
  if (code === "email_provider_disabled") {
    message = "Email/password sign-in is disabled for this project.";
  }
  if (code === "captcha_failed") {
    message = "Captcha failed. Please try again.";
  }
  return { error: message, code, status: error.status };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      accessToken: session?.access_token ?? null,
      loading,
      signIn: async (email, password) => {
        try {
          const { error } = await supabase.auth.signInWithPassword({
            email: normalizeEmail(email),
            password,
          });
          return toAuthResult(error as AuthError | null);
        } catch (err) {
          return toAuthResult(err as AuthError);
        }
      },
      signUp: async (email, password) => {
        const redirectBase = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, "");
        try {
          const { data, error } = await supabase.auth.signUp({
            email: normalizeEmail(email),
            password,
            options: {
              emailRedirectTo: `${redirectBase}/login`,
            },
          });
          const result = toAuthResult(error as AuthError | null);
          if (result.error) return result;
          return { needsEmailConfirm: !data.session };
        } catch (err) {
          return toAuthResult(err as AuthError);
        }
      },
      resendConfirmation: async (email) => {
        try {
          const { error } = await supabase.auth.resend({
            type: "signup",
            email: normalizeEmail(email),
          });
          return toAuthResult(error as AuthError | null);
        } catch (err) {
          return toAuthResult(err as AuthError);
        }
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
