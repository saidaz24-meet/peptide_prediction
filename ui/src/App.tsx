// src/App.tsx
import React, { Suspense, useCallback, useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";
import ScrollToTop from "@/components/ScrollToTop";
import { ValidationBanner } from "@/components/ValidationBanner";
import { AppSidebar } from "@/components/AppSidebar";
import { TopNav } from "@/components/TopNav";
import { PageTransition } from "@/components/PageTransition";
import { useJobStore } from "@/stores/jobStore";
import { useDemoMode } from "@/hooks/useDemoMode";
import { DemoModeChip } from "@/components/DemoModeChip";
import { FirstVisitModal } from "@/components/FirstVisitModal";
import { DemoCoachmark } from "@/components/DemoCoachmark";
import { DrillDownProvider, DrillDown } from "@/components/drilldown";
import { initSentrySession, setPVLSentryContext } from "@/lib/sentryContext";

// Lazy-loaded pages (Index kept direct for instant first load)
const Upload = React.lazy(() => import("./pages/Upload"));
const Results = React.lazy(() => import("./pages/Results"));
const PeptideDetail = React.lazy(() => import("./pages/PeptideDetail"));
const MetricDetail = React.lazy(() => import("./pages/MetricDetail"));
const Help = React.lazy(() => import("./pages/Help"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const About = React.lazy(() => import("@/pages/About"));
const QuickAnalyze = React.lazy(() => import("@/pages/QuickAnalyze"));
const Compare = React.lazy(() => import("@/pages/Compare"));
const DatabaseSearch = React.lazy(() => import("@/pages/DatabaseSearch"));

const queryClient = new QueryClient();

/** Inner layout that switches between TopNav (landing) and Sidebar (app pages) */
function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === "/";
  const demoMode = useDemoMode();
  const [tourActive, setTourActive] = useState(false);

  // FirstVisitModal "Take a tour" → ensure user is on /results, then run.
  // Sentry tag lets us measure tour-start funnel separately from completion.
  const startTour = useCallback(() => {
    try {
      Sentry.setTag("coachmark_started", "true");
    } catch {
      // Sentry may not be initialized in dev / tests
    }
    if (location.pathname !== "/results") {
      navigate("/results");
    }
    // Wait for the route + dataset to settle before joyride scans for targets.
    window.setTimeout(() => setTourActive(true), 350);
  }, [location.pathname, navigate]);

  // Set global navigate for job store polling callbacks
  useEffect(() => {
    window.__pvlNavigate = navigate;
    return () => {
      window.__pvlNavigate = undefined;
    };
  }, [navigate]);

  // Resume polling for any persisted active jobs on mount
  useEffect(() => {
    useJobStore.getState().resumePolling();
  }, []);

  // V6-1: initialize Sentry user + initial viewport/theme context once on mount.
  useEffect(() => {
    initSentrySession();
    const viewport =
      window.innerWidth < 640 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop";
    const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setPVLSentryContext({ viewport, theme });
  }, []);

  return (
    <>
      <ScrollToTop />
      {isLanding ? (
        /* Landing page: TopNav + full-width content, no sidebar */
        <>
          <TopNav />
          <main className="min-h-screen">
            <Suspense
              fallback={
                <div className="flex items-center justify-center min-h-screen">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Index />} />
              </Routes>
            </Suspense>
          </main>
        </>
      ) : (
        /* App pages: Sidebar + constrained content */
        <div className="flex min-h-screen">
          <AppSidebar />
          <main className="flex-1 min-w-0 pt-12 md:pt-0">
            <Suspense
              fallback={
                <div className="flex items-center justify-center min-h-screen">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }
            >
              <Routes>
                <Route
                  path="/upload"
                  element={
                    <PageTransition>
                      <Upload />
                    </PageTransition>
                  }
                />
                <Route
                  path="/results"
                  element={
                    <PageTransition>
                      <Results />
                    </PageTransition>
                  }
                />
                <Route
                  path="/peptides/:id"
                  element={
                    <PageTransition>
                      <PeptideDetail />
                    </PageTransition>
                  }
                />
                <Route
                  path="/metrics/:metricId"
                  element={
                    <PageTransition>
                      <MetricDetail />
                    </PageTransition>
                  }
                />
                <Route
                  path="/help"
                  element={
                    <PageTransition>
                      <Help />
                    </PageTransition>
                  }
                />
                <Route
                  path="/about"
                  element={
                    <PageTransition>
                      <About />
                    </PageTransition>
                  }
                />
                <Route
                  path="/quick"
                  element={
                    <PageTransition>
                      <QuickAnalyze />
                    </PageTransition>
                  }
                />
                <Route
                  path="/compare"
                  element={
                    <PageTransition>
                      <Compare />
                    </PageTransition>
                  }
                />
                <Route
                  path="/search"
                  element={
                    <PageTransition>
                      <DatabaseSearch />
                    </PageTransition>
                  }
                />
                <Route
                  path="*"
                  element={
                    <PageTransition>
                      <NotFound />
                    </PageTransition>
                  }
                />
              </Routes>
            </Suspense>
          </main>
        </div>
      )}

      {/* V5-1: Demo Mode chip + first-visit modal — root-level, outside Routes
          so they persist across navigation and never collide with page layouts. */}
      <DemoModeChip
        isDemo={demoMode.isDemo}
        isDemoLoading={demoMode.isDemoLoading}
        isChipDismissed={demoMode.isChipDismissed}
        clearDemo={demoMode.clearDemo}
        dismissChip={demoMode.dismissChip}
      />
      <FirstVisitModal
        open={demoMode.showFirstVisit}
        onDismiss={demoMode.dismissFirstVisit}
        onTour={startTour}
      />
      <DemoCoachmark run={tourActive} onComplete={() => setTourActive(false)} />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <ValidationBanner />
      <BrowserRouter>
        <DrillDownProvider>
          <AppLayout />
          <DrillDown />
        </DrillDownProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
