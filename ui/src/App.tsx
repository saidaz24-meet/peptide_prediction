// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Toaster as HotToaster } from "react-hot-toast";
import Index from "./pages/Index";
import Upload from "./pages/Upload";
import Results from "./pages/Results";
import PeptideDetail from "./pages/PeptideDetail";
import MetricDetail from "./pages/MetricDetail";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import About from "@/pages/About";
import { Info, Zap } from "lucide-react";
import ScrollToTop from "@/components/ScrollToTop";
import { useState, useCallback } from "react";

// NEW
import QuickAnalyze from "@/pages/QuickAnalyze";
import ScreenTransition from "@/components/ScreenTransition";

const queryClient = new QueryClient();

function FloatingChips() {
  const nav = useNavigate();
  const [phase, setPhase] = useState<"idle" | "enter" | "exit">("idle");
  const [target, setTarget] = useState<string | null>(null);
  const [clickPos, setClickPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  const go = useCallback((path: string, event: React.MouseEvent<HTMLButtonElement>) => {
    // Capture button center position
    const rect = event.currentTarget.getBoundingClientRect();
    setClickPos({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    });
    
    setTarget(path);
    setPhase("enter");
  }, []);

  return (
    <>
      <ScreenTransition
        phase={phase}
        clickPosition={clickPos}  
        onHalfway={() => {
          // Navigate when screen is fully covered
          if (target) nav(target);
          setPhase("exit");
        }}
        onDone={() => setPhase("idle")}
      />

      {/* About chip */}
      <button
        aria-label="About"
        onClick={(e) => go("/about", e)} 
        title="About / Acknowledgements"
        className="
          fixed bottom-4 right-4 z-40
          rounded-full border shadow
          bg-background/80 backdrop-blur
          p-2 text-muted-foreground hover:text-foreground
          hover:bg-background transition
          active:scale-95
        "
      >
        <Info className="h-5 w-5" />
      </button>

      {/* Quick analyze chip */}
      <button
        aria-label="Quick analyze"
        onClick={(e) => go("/quick", e)}
        title="Quick Analyze (single peptide)"
        className="
          fixed bottom-4 right-16 z-40
          rounded-full border shadow
          bg-background/80 backdrop-blur
          p-2 text-muted-foreground hover:text-foreground
          hover:bg-background transition
          active:scale-95
        "
      >
        <Zap className="h-5 w-5" />
      </button>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HotToaster position="top-right" />
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/results" element={<Results />} />
          <Route path="/peptides/:id" element={<PeptideDetail />} />
          <Route path="/metrics/:metricId" element={<MetricDetail />} />
          <Route path="/help" element={<Help />} />
          <Route path="/about" element={<About />} />
          {/* NEW */}
          <Route path="/quick" element={<QuickAnalyze />} />
          <Route path="*" element={<NotFound />} />
        </Routes>

        {/* Floating chips with fancy transition */}
        <FloatingChips />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
