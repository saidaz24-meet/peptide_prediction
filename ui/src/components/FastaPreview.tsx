/**
 * FastaPreview — focused preview card surfaced after a FASTA file is dropped
 * on the Upload page (§F, 2026-05-12).
 *
 * Replaces the generic table preview with a confidence-building summary:
 *   "X sequences detected from <file>"
 *   First 3 entries (id + truncated sequence + length badge)
 *
 * Lets the user confirm the FASTA parser found what they expected before
 * the analysis kicks off. Backend (T2 §H) accepts the same parsed entries
 * via `POST /api/predict/batch` with Content-Type: text/x-fasta — the
 * preview is purely presentational.
 */

import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface FastaEntry {
  /** Header id, e.g. "sp|P12345|FOO" or just "seq_1". */
  id: string;
  /** Single-letter amino-acid sequence (whitespace-stripped). */
  sequence: string;
}

interface FastaPreviewProps {
  /** Original filename — surfaced in the heading. */
  fileName: string;
  /** Parsed entries (may be a head of the full set when the parser caps preview rows). */
  entries: FastaEntry[];
  /**
   * True total sequence count. Defaults to `entries.length`. Pass explicitly
   * when the parsed entries array is truncated (e.g., capped at 200 rows for
   * display) so the summary line still reports the real number.
   */
  totalCount?: number;
  /** How many entries to show fully — default 3, per §F spec. */
  previewCount?: number;
  /** Max characters of sequence to show in each preview row. */
  truncateAt?: number;
}

const DEFAULT_TRUNCATE = 60;

function truncateSeq(seq: string, max: number): { text: string; truncated: boolean } {
  if (seq.length <= max) return { text: seq, truncated: false };
  return { text: seq.slice(0, max) + "…", truncated: true };
}

export function FastaPreview({
  fileName,
  entries,
  totalCount,
  previewCount = 3,
  truncateAt = DEFAULT_TRUNCATE,
}: FastaPreviewProps) {
  const total = totalCount ?? entries.length;
  const head = entries.slice(0, previewCount);
  const remaining = Math.max(0, total - head.length);

  return (
    <div
      className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3"
      data-testid="fasta-preview"
      aria-label="FASTA file preview"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            <span data-testid="fasta-preview-count">
              {total.toLocaleString()}
            </span>{" "}
            sequence{total === 1 ? "" : "s"} detected from your FASTA file
          </p>
          <p
            className="text-xs text-muted-foreground font-mono truncate"
            title={fileName}
          >
            {fileName}
          </p>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          FASTA
        </Badge>
      </div>

      {head.length > 0 && (
        <div
          className="rounded-lg border border-border/40 bg-background/40 divide-y divide-border/40"
          data-testid="fasta-preview-rows"
        >
          {head.map((entry, idx) => {
            const trunc = truncateSeq(entry.sequence, truncateAt);
            return (
              <div
                key={`${entry.id}-${idx}`}
                className="px-3 py-2 flex items-start gap-3"
                data-testid="fasta-preview-row"
              >
                <span
                  className="text-xs font-mono text-foreground/90 shrink-0 max-w-[140px] truncate"
                  title={entry.id}
                >
                  {entry.id}
                </span>
                <span
                  className="text-xs font-mono text-muted-foreground min-w-0 flex-1 break-all"
                  title={entry.sequence}
                >
                  {trunc.text}
                </span>
                <span className="text-[10px] text-muted-foreground/70 font-mono tabular-nums shrink-0">
                  {entry.sequence.length} aa
                </span>
              </div>
            );
          })}
          {remaining > 0 && (
            <div
              className="px-3 py-1.5 text-xs text-muted-foreground/80 italic"
              data-testid="fasta-preview-more"
            >
              + {remaining.toLocaleString()} more sequence
              {remaining === 1 ? "" : "s"}
            </div>
          )}
        </div>
      )}

      {total === 0 && head.length === 0 && (
        <p
          className="text-xs text-muted-foreground italic"
          data-testid="fasta-preview-empty"
        >
          No sequences detected — check the file format (each entry needs a
          {" "}<code>&gt;header</code> line).
        </p>
      )}
    </div>
  );
}
