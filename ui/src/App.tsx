// src/App.tsx
import React, { Suspense, useEffect } from "react";
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
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <ValidationBanner />
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
