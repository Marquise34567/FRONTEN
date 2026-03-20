import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Suspense, lazy, useEffect, useRef, type ReactNode } from "react";
import Index from "./pages/Index";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import RequireDevAdmin from "@/components/RequireDevAdmin";
import { useScreenProfile } from "@/hooks/use-screen-profile";
import { ApiError, apiFetch } from "@/lib/api";
import { getAnalyticsSessionId, trackAnalyticsEvent } from "@/lib/analytics";
import { useRealtimePresence } from "@/hooks/use-realtime-presence";
import { PENDING_REFERRAL_CODE_KEY, parseReferralCode } from "@/lib/referrals";

const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Editor = lazy(() => import("./pages/Editor"));
const EditorAMode = lazy(() => import("./pages/EditorAMode"));
const VerticalExtras = lazy(() => import("./pages/VerticalExtras"));
const PremiumTitleGenerator = lazy(() => import("./pages/PremiumTitleGenerator"));
const ShortsModeDemo = lazy(() => import("./pages/ShortsModeDemo"));
const JobDetail = lazy(() => import("./pages/JobDetail"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const HowEditorWorks = lazy(() => import("./pages/HowEditorWorks"));
const BillingSuccess = lazy(() => import("./pages/BillingSuccess"));
const GoogleTagSetup = lazy(() => import("./pages/GoogleTagSetup"));
const ControlPanel = lazy(() => import("./pages/ControlPanel"));
const ControlPanelAudience = lazy(() => import("./pages/ControlPanelAudience"));
const ControlPanelAlgorithm = lazy(() => import("./pages/ControlPanelAlgorithm"));
const ControlPanelBank = lazy(() => import("./pages/ControlPanelBank"));
const ControlPanelEmotion = lazy(() => import("./pages/ControlPanelEmotion"));
const ControlPanelGrowth = lazy(() => import("./pages/ControlPanelGrowth"));
const ControlPanelInfrastructure = lazy(() => import("./pages/ControlPanelInfrastructure"));
const ControlPanelOps = lazy(() => import("./pages/ControlPanelOps"));
const ControlPanelSecurity = lazy(() => import("./pages/ControlPanelSecurity"));
const ControlPanelAnalytics = lazy(() => import("./pages/ControlPanelAnalytics"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

const RouteFallback = () => <div className="min-h-screen w-full bg-background" aria-hidden="true" />;

const RouteSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<RouteFallback />}>{children}</Suspense>
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

const RealtimePresenceBridge = () => {
  const { accessToken } = useAuth();
  useRealtimePresence(accessToken);
  return null;
};

const PendingReferralBridge = () => {
  const { user, accessToken, loading } = useAuth();
  const lastHandledUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !user?.id || !accessToken) return;
    if (lastHandledUserIdRef.current === user.id) return;

    const pendingCode = (() => {
      try {
        return parseReferralCode(window.localStorage.getItem(PENDING_REFERRAL_CODE_KEY));
      } catch {
        return null;
      }
    })();

    if (!pendingCode) {
      lastHandledUserIdRef.current = user.id;
      return;
    }

    let canceled = false;
    void apiFetch("/api/me/referrals/apply", {
      method: "POST",
      token: accessToken,
      body: JSON.stringify({ code: pendingCode }),
    })
      .catch((error) => {
        if (!(error instanceof ApiError)) return;
        const terminalCodes = new Set([
          "referral_already_applied",
          "invalid_referral_code",
          "referral_not_found",
          "self_referral_not_allowed",
        ]);
        if (!terminalCodes.has(String(error.code || ""))) return;
      })
      .finally(() => {
        if (canceled) return;
        try {
          window.localStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
        } catch {
          // ignore storage failures
        }
        lastHandledUserIdRef.current = user.id;
      });

    return () => {
      canceled = true;
    };
  }, [accessToken, loading, user?.id]);

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

const NOINDEX_ROUTE_PATTERNS: RegExp[] = [
  /^\/login\/?$/i,
  /^\/signup\/?$/i,
  /^\/editor(?:\/.*)?$/i,
  /^\/title-generator\/?$/i,
  /^\/app(?:\/.*)?$/i,
  /^\/settings\/?$/i,
  /^\/billing\/success\/?$/i,
  /^\/preview\/google-ads-tracking\/?$/i,
  /^\/dev\/control-panel(?:\/.*)?$/i,
  /^\/control-panel(?:\/.*)?$/i,
  /^\/__control-panel(?:\/.*)?$/i,
  /^\/x-quantum-control-9\/?$/i,
];

const RouteIndexingGuard = () => {
  const location = useLocation();

  useEffect(() => {
    const shouldNoindex = NOINDEX_ROUTE_PATTERNS.some((pattern) => pattern.test(location.pathname));
    const desiredRobots = shouldNoindex ? "noindex, nofollow" : "index, follow";
    let robotsTag = document.head.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robotsTag) {
      robotsTag = document.createElement("meta");
      robotsTag.setAttribute("name", "robots");
      document.head.appendChild(robotsTag);
    }
    robotsTag.setAttribute("content", desiredRobots);
  }, [location.pathname]);

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

const AuthenticatedRoutePrefetch = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    const nav = navigator as Navigator & {
      connection?: {
        saveData?: boolean;
        effectiveType?: string;
      };
      deviceMemory?: number;
    };
    const connection = nav.connection;
    const effectiveType = String(connection?.effectiveType || "").toLowerCase();
    const saveDataEnabled = Boolean(connection?.saveData);
    const lowMemoryDevice = Number.isFinite(Number(nav.deviceMemory)) && Number(nav.deviceMemory) <= 2;
    const slowConnection = effectiveType.includes("2g") || effectiveType.includes("slow-2g");
    if (saveDataEnabled || lowMemoryDevice || slowConnection) return;

    const queue: Array<() => Promise<unknown>> = [
      () => import("./pages/Editor"),
      () => import("./pages/Settings"),
      () => import("./pages/VerticalExtras"),
    ];

    let canceled = false;
    let warmupTimer: number | null = null;
    let stepTimer: number | null = null;
    let idleId: number | null = null;
    let cursor = 0;

    const runNext = () => {
      if (canceled || cursor >= queue.length) return;
      const task = queue[cursor];
      cursor += 1;
      void task().catch(() => null);
      if (cursor >= queue.length) return;

      const scheduleStep = () => {
        if (canceled) return;
        runNext();
      };

      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(scheduleStep, { timeout: 2000 });
      } else {
        stepTimer = window.setTimeout(scheduleStep, 1200);
      }
    };

    warmupTimer = window.setTimeout(() => {
      if (canceled) return;
      const start = () => runNext();
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(start, { timeout: 3000 });
      } else {
        start();
      }
    }, 2200);

    return () => {
      canceled = true;
      if (warmupTimer !== null) window.clearTimeout(warmupTimer);
      if (stepTimer !== null) window.clearTimeout(stepTimer);
      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [user?.id]);

  return null;
};

const App = () => {
  useScreenProfile();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ClientErrorReporter />
        <RealtimePresenceBridge />
        <PendingReferralBridge />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RouteViewTracker />
            <RouteIndexingGuard />
            <YouTubeOAuthCallbackBridge />
            <AuthenticatedRoutePrefetch />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route
                path="/login"
                element={
                  <RouteSuspense>
                    <Login />
                  </RouteSuspense>
                }
              />
              <Route
                path="/signup"
                element={
                  <RouteSuspense>
                    <Signup />
                  </RouteSuspense>
                }
              />
              <Route
                path="/pricing"
                element={
                  <RouteSuspense>
                    <Pricing />
                  </RouteSuspense>
                }
              />
              <Route
                path="/privacy-policy"
                element={
                  <RouteSuspense>
                    <PrivacyPolicy />
                  </RouteSuspense>
                }
              />
              <Route
                path="/how-editor-works"
                element={
                  <RouteSuspense>
                    <HowEditorWorks />
                  </RouteSuspense>
                }
              />
              <Route
                path="/shorts-mode-demo"
                element={
                  <RouteSuspense>
                    <ShortsModeDemo />
                  </RouteSuspense>
                }
              />
              <Route
                path="/billing/success"
                element={
                  <RouteSuspense>
                    <BillingSuccess />
                  </RouteSuspense>
                }
              />
              <Route
                path="/preview/google-ads-tracking"
                element={
                  <RouteSuspense>
                    <GoogleTagSetup />
                  </RouteSuspense>
                }
              />
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
                    <RouteSuspense>
                      <Editor />
                    </RouteSuspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/title-generator"
                element={
                  <RequireAuth>
                    <RouteSuspense>
                      <PremiumTitleGenerator />
                    </RouteSuspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/editor/a-mode"
                element={
                  <RequireAuth>
                    <RouteSuspense>
                      <EditorAMode />
                    </RouteSuspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/editor/vertical-extras"
                element={
                  <RequireAuth>
                    <RouteSuspense>
                      <VerticalExtras />
                    </RouteSuspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/app/job/:id"
                element={
                  <RequireAuth>
                    <RouteSuspense>
                      <JobDetail />
                    </RouteSuspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <RouteSuspense>
                      <Settings />
                    </RouteSuspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/editor/google-ads-tracking"
                element={
                  <RequireAuth>
                    <RouteSuspense>
                      <GoogleTagSetup />
                    </RouteSuspense>
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
                      <RouteSuspense>
                        <ControlPanel />
                      </RouteSuspense>
                    </RequireDevAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="/dev/control-panel/emotion"
                element={
                  <RequireAuth>
                    <RequireDevAdmin>
                      <RouteSuspense>
                        <ControlPanelEmotion />
                      </RouteSuspense>
                    </RequireDevAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="/dev/control-panel/analytics"
                element={
                  <RequireAuth>
                    <RequireDevAdmin>
                      <RouteSuspense>
                        <ControlPanelAnalytics />
                      </RouteSuspense>
                    </RequireDevAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="/dev/control-panel/audience"
                element={
                  <RequireAuth>
                    <RequireDevAdmin>
                      <RouteSuspense>
                        <ControlPanelAudience />
                      </RouteSuspense>
                    </RequireDevAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="/dev/control-panel/growth"
                element={
                  <RequireAuth>
                    <RequireDevAdmin>
                      <RouteSuspense>
                        <ControlPanelGrowth />
                      </RouteSuspense>
                    </RequireDevAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="/dev/control-panel/infrastructure"
                element={
                  <RequireAuth>
                    <RequireDevAdmin>
                      <RouteSuspense>
                        <ControlPanelInfrastructure />
                      </RouteSuspense>
                    </RequireDevAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="/dev/control-panel/security"
                element={
                  <RequireAuth>
                    <RequireDevAdmin>
                      <RouteSuspense>
                        <ControlPanelSecurity />
                      </RouteSuspense>
                    </RequireDevAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="/dev/control-panel/algorithm"
                element={
                  <RequireAuth>
                    <RequireDevAdmin>
                      <RouteSuspense>
                        <ControlPanelAlgorithm />
                      </RouteSuspense>
                    </RequireDevAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="/dev/control-panel/bank"
                element={
                  <RequireAuth>
                    <RequireDevAdmin>
                      <RouteSuspense>
                        <ControlPanelBank />
                      </RouteSuspense>
                    </RequireDevAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="/dev/control-panel/ops"
                element={
                  <RequireAuth>
                    <RequireDevAdmin>
                      <RouteSuspense>
                        <ControlPanelOps />
                      </RouteSuspense>
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
              <Route
                path="*"
                element={
                  <RouteSuspense>
                    <NotFound />
                  </RouteSuspense>
                }
              />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
