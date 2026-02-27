import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import RequireDevAdmin from "@/components/RequireDevAdmin";
import { useScreenProfile } from "@/hooks/use-screen-profile";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { LiveStatsProvider } from "@/providers/LiveStatsProvider";
import GlobalLiveBadge from "@/components/live/GlobalLiveBadge";
import { useMe } from "@/hooks/use-me";
import { isPaidTier, PLAN_CONFIG, type PlanTier } from "@/shared/planConfig";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Editor = lazy(() => import("./pages/Editor"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Jobs = lazy(() => import("./pages/Jobs"));
const JobDetail = lazy(() => import("./pages/JobDetail"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Settings = lazy(() => import("./pages/Settings"));
const Feedback = lazy(() => import("./pages/Feedback"));
const NotFound = lazy(() => import("./pages/NotFound"));
const BillingSuccess = lazy(() => import("./pages/BillingSuccess"));
const ControlPanel = lazy(() => import("./pages/ControlPanel"));
const ControlPanelAudience = lazy(() => import("./pages/ControlPanelAudience"));
const ControlPanelAlgorithm = lazy(() => import("./pages/ControlPanelAlgorithm"));
const ControlPanelBank = lazy(() => import("./pages/ControlPanelBank"));
const ControlPanelEmotion = lazy(() => import("./pages/ControlPanelEmotion"));
const ControlPanelGrowth = lazy(() => import("./pages/ControlPanelGrowth"));
const ControlPanelInfrastructure = lazy(() => import("./pages/ControlPanelInfrastructure"));
const ControlPanelOps = lazy(() => import("./pages/ControlPanelOps"));
const ControlPanelSecurity = lazy(() => import("./pages/ControlPanelSecurity"));
const ControlPanelBlacksite = lazy(() => import("./pages/ControlPanelBlacksite"));

const RouteLoader = () => (
  <div className="min-h-screen bg-[#0f1117] text-slate-100">
    <div className="mx-auto flex min-h-screen w-full max-w-[1200px] items-center justify-center px-4">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-500/35 border-t-slate-100" />
    </div>
  </div>
);

const ClientErrorReporter = () => {
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) return;

    const sendClientError = (payload: {
      message: string;
      stack?: string | null;
      pagePath?: string | null;
      severity?: "low" | "medium" | "high" | "critical";
    }) => {
      void apiFetch("/api/analytics/client-error", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(payload),
      }).catch(() => null);
    };

    const onError = (event: ErrorEvent) => {
      sendClientError({
        message: event.message || "window_error",
        stack: event.error?.stack ? String(event.error.stack).slice(0, 1800) : null,
        pagePath: window.location?.pathname || "/",
        severity: "medium",
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        typeof event.reason === "string"
          ? event.reason
          : event.reason?.message
          ? String(event.reason.message)
          : "unhandled_rejection";
      const stack = event.reason?.stack ? String(event.reason.stack).slice(0, 1800) : null;
      sendClientError({
        message: reason,
        stack,
        pagePath: window.location?.pathname || "/",
        severity: "high",
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [accessToken]);

  return null;
};

const RequirePaid = ({ children }: { children: ReactNode }) => {
  const { data: me, isLoading } = useMe();
  const rawTier = (me?.subscription?.tier as string | undefined) || "free";
  const tier: PlanTier = PLAN_CONFIG[rawTier as PlanTier] ? (rawTier as PlanTier) : "free";
  const isDevAccount = Boolean(me?.flags?.dev);
  if (isLoading) return null;
  if (!isDevAccount && !isPaidTier(tier)) {
    return <Navigate to="/pricing" replace />;
  }
  return <>{children}</>;
};

const App = () => {
  useScreenProfile();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ClientErrorReporter />
        <LiveStatsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<RouteLoader />}>
                <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/billing/success" element={<BillingSuccess />} />
                <Route
                  path="/app"
                  element={
                    <RequireAuth>
                      <Navigate to="/dashboard" replace />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <Dashboard />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashed-board"
                  element={
                    <RequireAuth>
                      <Navigate to="/dashboard" replace />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/editor"
                  element={
                    <RequireAuth>
                      <Editor />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/editor/vertical"
                  element={
                    <RequireAuth>
                      <Editor verticalModeExperience />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/vibecut"
                  element={
                    <RequireAuth>
                      <Navigate to="/editor" replace />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <RequireAuth>
                      <RequirePaid>
                        <Analytics />
                      </RequirePaid>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/feedback"
                  element={
                    <RequireAuth>
                      <RequirePaid>
                        <Feedback />
                      </RequirePaid>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/app/job/:id"
                  element={
                    <RequireAuth>
                      <JobDetail />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RequireAuth>
                      <Settings />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/jobs"
                  element={
                    <RequireAuth>
                      <Jobs />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dev/control-panel"
                  element={
                    <RequireAuth>
                      <RequireDevAdmin>
                        <Navigate to="/dev/control-panel/overview" replace />
                      </RequireDevAdmin>
                    </RequireAuth>
                  }
                />
                  <Route
                    path="/control-panel"
                    element={
                      <RequireAuth>
                        <RequireDevAdmin>
                          <ControlPanel />
                        </RequireDevAdmin>
                      </RequireAuth>
                    }
                  />
                <Route
                  path="/__control-panel"
                  element={
                    <RequireAuth>
                      <RequireDevAdmin>
                        <Navigate to="/dev/control-panel/overview" replace />
                      </RequireDevAdmin>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dev/control-panel/overview"
                  element={
                    <RequireAuth>
                      <RequireDevAdmin>
                        <ControlPanel />
                      </RequireDevAdmin>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dev/control-panel/emotion"
                  element={
                    <RequireAuth>
                      <RequireDevAdmin>
                        <ControlPanelEmotion />
                      </RequireDevAdmin>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dev/control-panel/audience"
                  element={
                    <RequireAuth>
                      <RequireDevAdmin>
                        <ControlPanelAudience />
                      </RequireDevAdmin>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dev/control-panel/growth"
                  element={
                    <RequireAuth>
                      <RequireDevAdmin>
                        <ControlPanelGrowth />
                      </RequireDevAdmin>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dev/control-panel/infrastructure"
                  element={
                    <RequireAuth>
                      <RequireDevAdmin>
                        <ControlPanelInfrastructure />
                      </RequireDevAdmin>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dev/control-panel/security"
                  element={
                    <RequireAuth>
                      <RequireDevAdmin>
                        <ControlPanelSecurity />
                      </RequireDevAdmin>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dev/control-panel/algorithm"
                  element={
                    <RequireAuth>
                      <RequireDevAdmin>
                        <ControlPanelAlgorithm />
                      </RequireDevAdmin>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dev/control-panel/bank"
                  element={
                    <RequireAuth>
                      <RequireDevAdmin>
                        <ControlPanelBank />
                      </RequireDevAdmin>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dev/control-panel/ops"
                  element={
                    <RequireAuth>
                      <RequireDevAdmin>
                        <ControlPanelOps />
                      </RequireDevAdmin>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dev/control-panel/blacksite"
                  element={
                    <RequireAuth>
                      <RequireDevAdmin>
                        <ControlPanelBlacksite />
                      </RequireDevAdmin>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/x-quantum-control-9"
                  element={
                    <RequireAuth>
                      <RequireDevAdmin>
                        <ControlPanelBlacksite />
                      </RequireDevAdmin>
                    </RequireAuth>
                  }
                />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <GlobalLiveBadge />
            </BrowserRouter>
          </TooltipProvider>
        </LiveStatsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
