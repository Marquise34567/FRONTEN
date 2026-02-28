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
import DevUpgradeModalPreview from "./pages/DevUpgradeModalPreview";
import { AuthProvider } from "@/providers/AuthProvider";
import RequireAuth from "@/components/RequireAuth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
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
            <Route path="/dev/upgrade-modal" element={<DevUpgradeModalPreview />} />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
