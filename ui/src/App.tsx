import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Toaster as HotToaster } from "react-hot-toast";
import Index from "./pages/Index";
import Upload from "./pages/Upload";
import Results from "./pages/Results";
import PeptideDetail from "./pages/PeptideDetail";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import About from "@/pages/About";
import { Info, Zap } from "lucide-react";
import ScrollToTop from "@/components/ScrollToTop";

// NEW
import QuickAnalyze from "@/pages/QuickAnalyze";

const queryClient = new QueryClient();

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
          <Route path="/help" element={<Help />} />
          <Route path="/about" element={<About />} />
          {/* NEW */}
          <Route path="/quick" element={<QuickAnalyze />} />
          <Route path="*" element={<NotFound />} />
        </Routes>

        {/* Existing about chip */}
        <Link
          to="/about"
          aria-label="About"
          className="
            fixed bottom-4 right-4 z-40
            rounded-full border shadow
            bg-background/80 backdrop-blur
            p-2 text-muted-foreground hover:text-foreground
            hover:bg-background transition
          "
          title="About / Acknowledgements"
        >
          <Info className="h-5 w-5" />
        </Link>

        {/* NEW quick analyze chip */}
        <Link
          to="/quick"
          aria-label="Quick analyze"
          className="
            fixed bottom-4 right-16 z-40
            rounded-full border shadow
            bg-background/80 backdrop-blur
            p-2 text-muted-foreground hover:text-foreground
            hover:bg-background transition
          "
          title="Quick Analyze (single peptide)"
        >
          <Zap className="h-5 w-5" />
        </Link>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
