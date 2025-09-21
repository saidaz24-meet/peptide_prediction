import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function About() {
  const navigate = useNavigate();

  const handleBack = () => {
    // Go back in history to preserve prior page state (table filters, tab, scroll, etc.)
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fallback if user entered /about directly (no history entry)
      navigate("/results"); // or "/upload" if you prefer
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      {/* Back button (small, unobtrusive) */}
      <div className="mb-2">
        <Button variant="outline" size="sm" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Title */}
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-bold text-foreground">Peptide Visual Lab</h1>
        <Badge variant="secondary">DESY • Landau Group</Badge>
      </div>

      {/* Purpose */}
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle>Purpose</CardTitle>
          <CardDescription>Internal, non-public application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Explore peptide properties and fibril-forming predictions. Upload UniProt exports (TSV/CSV/XLSX), compute
            hydrophobicity, charge, μH, and visualize JPred/Tango outputs when available.
          </p>
        </CardContent>
      </Card>

      {/* Acknowledgements */}
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle>Acknowledgements</CardTitle>
        </CardHeader>
      <CardContent className="space-y-2 text-sm">
          <p><b>Frontend design & implementation:</b> Said Azaizah</p>
          <p><b>Algorithmic approach & backend code:</b> provided by <b>Dr. Aleksandr Golubev</b></p>
          <p><b>JPred / Tango predictions:</b> courtesy of the lab’s existing pipelines</p>
        </CardContent>
      </Card>

      {/* Key Features */}
      <Card className="shadow-medium">
        <CardHeader><CardTitle>Key Features</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3 text-sm">
          <ul className="list-disc pl-5 space-y-1">
            <li>Flexible upload with QC (+ rejected rows export)</li>
            <li>Hydrophobicity, Charge, μH; Chameleon & FF-Helix</li>
            <li>Cohort visualizations + correlation matrix</li>
            <li>Sliding-window profiles with helix overlays</li>
          </ul>
          <ul className="list-disc pl-5 space-y-1">
            <li>Smart ranking & Top-N shortlist</li>
            <li>CSV & PDF report export</li>
            <li>UniProt & AlphaFold quick links</li>
            <li>Optional cloud save/load</li>
          </ul>
        </CardContent>
      </Card>

      {/* JPred / Tango note */}
      <Card className="shadow-medium">
        <CardHeader><CardTitle>JPred / Tango</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            The app reads local result files from <code>backend/Jpred/</code> and <code>backend/Tango/</code>. Set{" "}
            <code>USE_JPRED=1</code> / <code>USE_TANGO=1</code> before starting the API. Without these assets, related
            metrics display <em>Not available</em>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
