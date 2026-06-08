/**
 * CitationDialog — modal with BibTeX / RIS / plain-text citation formats.
 *
 * Opens from the ReproducibilityRibbon "Cite" button.
 * Each format has a "Copy" button. DOI placeholder included for future Zenodo wiring.
 */

import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import {
  generatePlainCitation,
  generateBibTeX,
  generateRIS,
  type CitationParams,
} from "@/lib/permalink";

// ── Props ──────────────────────────────────────────────────────────────────

interface CitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: CitationParams | null;
}

// ── Copy button with feedback ──────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Copy
        </>
      )}
    </Button>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function CitationDialog({ open, onOpenChange, params }: CitationDialogProps) {
  const plain = useMemo(() => (params ? generatePlainCitation(params) : ""), [params]);
  const bibtex = useMemo(() => (params ? generateBibTeX(params) : ""), [params]);
  const ris = useMemo(() => (params ? generateRIS(params) : ""), [params]);

  if (!params) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cite this analysis</DialogTitle>
          <DialogDescription>
            Copy a formatted citation for your publication or reference manager.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="plain" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="plain" className="flex-1">
              Plain text
            </TabsTrigger>
            <TabsTrigger value="bibtex" className="flex-1">
              BibTeX
            </TabsTrigger>
            <TabsTrigger value="ris" className="flex-1">
              RIS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plain" className="space-y-3 pt-3">
            <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs leading-relaxed text-foreground font-mono">
              {plain}
            </pre>
            <div className="flex justify-end">
              <CopyButton text={plain} />
            </div>
          </TabsContent>

          <TabsContent value="bibtex" className="space-y-3 pt-3">
            <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs leading-relaxed text-foreground font-mono">
              {bibtex}
            </pre>
            <div className="flex justify-end">
              <CopyButton text={bibtex} />
            </div>
          </TabsContent>

          <TabsContent value="ris" className="space-y-3 pt-3">
            <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs leading-relaxed text-foreground font-mono">
              {ris}
            </pre>
            <div className="flex justify-end">
              <CopyButton text={ris} />
            </div>
          </TabsContent>
        </Tabs>

        {/* 2026-06-08: Zenodo DOI mints at `gh release create v0.3.0` time;
            scripts/publish_v0_3_0.sh patches CITATION.cff + README with the
            real value. This placeholder UI line stays until the first release
            ships, after which the dialog can surface PVL_VERSION-aware DOIs. */}
        <p className="mt-2 text-[10px] text-muted-foreground/60">
          DOI: mints on first release; see CITATION.cff
        </p>
      </DialogContent>
    </Dialog>
  );
}
