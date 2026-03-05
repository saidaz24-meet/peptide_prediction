// src/App.tsx
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Upload from "./pages/Upload";
import Results from "./pages/Results";
import PeptideDetail from "./pages/PeptideDetail";
import MetricDetail from "./pages/MetricDetail";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import About from "@/pages/About";
import ScrollToTop from "@/components/ScrollToTop";
import QuickAnalyze from "@/pages/QuickAnalyze";
import Compare from "@/pages/Compare";
import { ValidationBanner } from "@/components/ValidationBanner";
import { AppSidebar } from "@/components/AppSidebar";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      {/* Development-only validation banner */}
      <ValidationBanner />
      <BrowserRouter>
        <ScrollToTop />
        <div className="flex min-h-screen">
          <AppSidebar />
          <main className="flex-1 min-w-0">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/results" element={<Results />} />
              <Route path="/peptides/:id" element={<PeptideDetail />} />
              <Route path="/metrics/:metricId" element={<MetricDetail />} />
              <Route path="/help" element={<Help />} />
              <Route path="/about" element={<About />} />
              <Route path="/quick" element={<QuickAnalyze />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
