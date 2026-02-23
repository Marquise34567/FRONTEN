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
const SESSION_EXPIRY_SKEW_MS = 5_000;

const isSessionExpired = (session: Session | null | undefined) => {
  if (!session) return true;
  const expiresAtSeconds = session.expires_at;
  if (typeof expiresAtSeconds !== "number") return false;
  return expiresAtSeconds * 1000 <= Date.now() + SESSION_EXPIRY_SKEW_MS;
};

const toActiveSession = (session: Session | null | undefined) => {
  if (!session) return null;
  return isSessionExpired(session) ? null : session;
};

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
      const nextSession = toActiveSession(data.session);
      setSession(nextSession);
      setLoading(false);
      if (data.session && !nextSession) {
        supabase.auth.signOut().catch(() => {});
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const activeSession = toActiveSession(nextSession);
      setSession(activeSession);
      setLoading(false);
      if (nextSession && !activeSession) {
        supabase.auth.signOut().catch(() => {});
      }
    });
    const onExpired = () => {
      // on global auth expired event, sign out to clear session and update UI
      try {
        setSession(null);
        setLoading(false);
        supabase.auth.signOut().catch(() => {})
      } catch (e) {}
    }
    window.addEventListener('auth:expired', onExpired)
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      window.removeEventListener('auth:expired', onExpired)
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
