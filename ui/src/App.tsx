import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster as HotToaster } from 'react-hot-toast';
import Index from "./pages/Index";
import Upload from "./pages/Upload";
import Results from "./pages/Results";
import PeptideDetail from "./pages/PeptideDetail";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import About from "@/pages/About";
// App.tsx (add near other imports)
import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import ScrollToTop from "@/components/ScrollToTop";

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
          <Route path="*" element={<NotFound />} />
          <Route path="/about" element={<About />} />
        </Routes>

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

      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
