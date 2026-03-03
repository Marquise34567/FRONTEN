import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Editor from "./pages/Editor";
import JobDetail from "./pages/JobDetail";
import Pricing from "./pages/Pricing";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import HowEditorWorks from "./pages/HowEditorWorks";
import BillingSuccess from "./pages/BillingSuccess";
import GoogleTagSetup from "./pages/GoogleTagSetup";
import ControlPanel from "./pages/ControlPanel";
import ControlPanelAudience from "./pages/ControlPanelAudience";
import ControlPanelAlgorithm from "./pages/ControlPanelAlgorithm";
import ControlPanelBank from "./pages/ControlPanelBank";
import ControlPanelEmotion from "./pages/ControlPanelEmotion";
import ControlPanelGrowth from "./pages/ControlPanelGrowth";
import ControlPanelInfrastructure from "./pages/ControlPanelInfrastructure";
import ControlPanelOps from "./pages/ControlPanelOps";
import ControlPanelSecurity from "./pages/ControlPanelSecurity";
import ControlPanelAnalytics from "./pages/ControlPanelAnalytics";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import RequireDevAdmin from "@/components/RequireDevAdmin";
import { useScreenProfile } from "@/hooks/use-screen-profile";
import { useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { getAnalyticsSessionId, trackAnalyticsEvent } from "@/lib/analytics";
import { useRealtimePresence } from "@/hooks/use-realtime-presence";

const queryClient = new QueryClient();

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

const RealtimePresenceBridge = () => {
  const { accessToken } = useAuth();
  useRealtimePresence(accessToken);
  return null;
};

const RouteViewTracker = () => {
  const { accessToken } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!accessToken) return;
    void trackAnalyticsEvent(
      {
        eventName: "app_page_view",
        category: "page_view",
        sessionId: getAnalyticsSessionId(),
        pagePath: `${location.pathname}${location.search || ""}`,
        metadata: {
          source: "route_tracker",
        },
      },
      accessToken
    );
  }, [accessToken, location.pathname, location.search]);

  return null;
};

const YouTubeOAuthCallbackBridge = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (location.pathname !== "/") return;

    const params = new URLSearchParams(location.search);
    const oauthCode = String(params.get("code") || "").trim();
    const oauthState = String(params.get("state") || "").trim();
    const oauthScope = String(params.get("scope") || "").toLowerCase();
    if (!oauthCode || !oauthState || !oauthScope.includes("youtube")) return;
    if (!user) return;

    navigate(`/editor${location.search || ""}`, { replace: true });
  }, [loading, location.pathname, location.search, navigate, user]);

  return null;
};

const App = () => {
  useScreenProfile();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ClientErrorReporter />
        <RealtimePresenceBridge />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RouteViewTracker />
            <YouTubeOAuthCallbackBridge />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/how-editor-works" element={<HowEditorWorks />} />
              <Route path="/billing/success" element={<BillingSuccess />} />
              <Route path="/preview/google-ads-tracking" element={<GoogleTagSetup />} />
              <Route
                path="/app"
                element={
                  <RequireAuth>
                    <Navigate to="/editor" replace />
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
                path="/editor/google-ads-tracking"
                element={
                  <RequireAuth>
                    <GoogleTagSetup />
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
                      <Navigate to="/dev/control-panel/overview" replace />
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
                path="/dev/control-panel/analytics"
                element={
                  <RequireAuth>
                    <RequireDevAdmin>
                      <ControlPanelAnalytics />
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
                path="/x-quantum-control-9"
                element={
                  <RequireAuth>
                    <RequireDevAdmin>
                      <Navigate to="/dev/control-panel/overview" replace />
                    </RequireDevAdmin>
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
