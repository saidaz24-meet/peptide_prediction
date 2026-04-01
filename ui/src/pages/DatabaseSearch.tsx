import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Database, ExternalLink, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UniProtQueryInput } from "@/components/UniProtQueryInput";
import { useDatasetStore } from "@/stores/datasetStore";
import { BgDotGrid } from "@/components/BgDotGrid";
import type { Peptide } from "@/types/peptide";

export default function DatabaseSearch() {
  const navigate = useNavigate();
  const { ingestBackendRows, peptides } = useDatasetStore();
  const [searchMeta, setSearchMeta] = useState<any>(null);
  const [searchRows, setSearchRows] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleQueryExecuted = (rows: any[], meta: any) => {
    setSearchMeta(meta);
    setSearchRows(rows);
    // Ingest directly into the dataset store
    ingestBackendRows(rows, meta);
    // Navigate to results
    navigate("/results");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 relative"
    >
      <BgDotGrid opacity={0.02} />

      {/* Header */}
      <div>
        <h1 className="text-h1 text-foreground page-header-title flex items-center gap-2">
          <Database className="w-6 h-6 text-primary" />
          Database Search
        </h1>
        <p className="text-body text-muted-foreground mt-1 hidden md:block">
          Search UniProt for protein sequences, then analyze them with PVL.
        </p>
      </div>

      {/* Search interface */}
      <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <UniProtQueryInput onQueryExecuted={handleQueryExecuted} onLoadingChange={setIsLoading} />
        </CardContent>
      </Card>

      {/* Quick tips */}
      <div className="grid sm:grid-cols-3 gap-3">
        <TipCard
          title="Keyword Search"
          example='"amyloid", "antimicrobial", "fibril"'
          description="Full-text search across all UniProt fields"
        />
        <TipCard
          title="Organism Search"
          example="9606 (human), 1280 (S. aureus)"
          description="NCBI taxonomy ID for organism-specific search"
        />
        <TipCard
          title="Accession Lookup"
          example="P02743, P05067, P84528"
          description="Direct lookup by UniProt accession ID"
        />
      </div>

      {/* Link to upload for file-based workflow */}
      <div className="flex items-center justify-between bg-[hsl(var(--surface-1))] rounded-xl px-4 py-3 border border-[hsl(var(--border))]">
        <div className="text-sm text-muted-foreground">
          Have a file? Upload CSV, Excel, or FASTA directly.
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/upload")}
          className="btn-press"
        >
          Upload File <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </div>
    </motion.div>
  );
}

function TipCard({
  title,
  example,
  description,
}: {
  title: string;
  example: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3.5 space-y-1">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <p className="text-[11px] font-mono text-primary">{example}</p>
      <p className="text-[10px] text-muted-foreground">{description}</p>
    </div>
  );
}
