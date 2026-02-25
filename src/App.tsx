import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Editor from "./pages/Editor";
import JobDetail from "./pages/JobDetail";
import Pricing from "./pages/Pricing";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import BillingSuccess from "./pages/BillingSuccess";
import ControlPanel from "./pages/ControlPanel";
import ControlPanelAlgorithm from "./pages/ControlPanelAlgorithm";
import ControlPanelBank from "./pages/ControlPanelBank";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import RequireDevAdmin from "@/components/RequireDevAdmin";
import { useScreenProfile } from "@/hooks/use-screen-profile";
import { useEffect } from "react";
import { apiFetch } from "@/lib/api";

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

const App = () => {
  useScreenProfile();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ClientErrorReporter />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
