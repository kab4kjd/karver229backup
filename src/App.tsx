import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { applyThemeSettings } from "@/lib/theme";
import { useThemeRealtimeSync } from "@/hooks/useThemeConfig";
import Auth from "./pages/Auth";
import "./App.css";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
import SingleTabGate from "@/components/karaoke/SingleTabGate";

const queryClient = new QueryClient();

const ThemeInitializer = () => {
  useThemeRealtimeSync();
  return null;
};

const AuthQuerySync = () => {
  const qc = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
        qc.invalidateQueries();
      }
    });
    return () => subscription.unsubscribe();
  }, [qc]);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthQuerySync />
    <ThemeInitializer />
    <TooltipProvider>
      <SingleTabGate />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><Index /></Suspense>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><NotFound /></Suspense>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
