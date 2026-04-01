/**
 * BackboneViewer — 2D backbone visualization from AlphaFold PDB files.
 * Ported from atom2svg.py by @biochem_fan (Alex's gist).
 *
 * Shows main chain as connected alpha carbons with color-coded residues:
 * - Red: acidic (D, E)
 * - Blue: basic (R, H, K)
 * - Green: hydrophilic (S, T, N, Q)
 * - White: hydrophobic (A, V, I, L, F, Y, W)
 * - Yellow: sulfur-containing (C, M)
 * - Pink: glycine (G)
 * - Purple: proline (P)
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { isValidUniProtAccession, fetchAlphaFoldEntry } from "@/lib/alphafold";
import { ChartExportButtons } from "@/components/ChartExportButtons";

// ── Residue classification and colors ──

const ONE_LETTER: Record<string, string> = {
  ARG: "R",
  HIS: "H",
  LYS: "K",
  ASP: "D",
  GLU: "E",
  SER: "S",
  THR: "T",
  ASN: "N",
  GLN: "Q",
  CYS: "C",
  GLY: "G",
  PRO: "P",
  ALA: "A",
  VAL: "V",
  ILE: "I",
  LEU: "L",
  MET: "M",
  PHE: "F",
  TYR: "Y",
  TRP: "W",
};

type ResidueClass = "a" | "b" | "w" | "n" | "g" | "s" | "p";

const RESIDUE_CLASS: Record<string, ResidueClass> = {
  ARG: "b",
  HIS: "b",
  LYS: "b",
  ASP: "a",
  GLU: "a",
  SER: "w",
  THR: "w",
  ASN: "w",
  GLN: "w",
  CYS: "s",
  GLY: "g",
  PRO: "p",
  ALA: "n",
  VAL: "n",
  ILE: "n",
  LEU: "n",
  MET: "s",
  PHE: "n",
  TYR: "n",
  TRP: "n",
};

const CLASS_COLORS: Record<ResidueClass, { fill: string; label: string }> = {
  a: { fill: "#ef4444", label: "Acidic (D, E)" },
  b: { fill: "#60a5fa", label: "Basic (R, H, K)" },
  w: { fill: "#22c55e", label: "Hydrophilic (S, T, N, Q)" },
  n: { fill: "#f5f5f5", label: "Hydrophobic (A, V, I, L, F, Y, W)" },
  g: { fill: "#f9a8d4", label: "Glycine (G)" },
  s: { fill: "#facc15", label: "Sulfur (C, M)" },
  p: { fill: "#a855f7", label: "Proline (P)" },
};

// ── PDB parsing ──

interface Atom {
  x: number;
  y: number;
  resName: string;
  resId: number;
}

function parsePDB(pdbText: string) {
  const cAlpha = new Map<number, Atom>();
  const cBeta = new Map<number, Atom>();

  for (const line of pdbText.split("\n")) {
    if (!line.startsWith("ATOM")) continue;
    try {
      const resName = line.substring(17, 20).trim();
      const atomName = line.substring(12, 16).trim();
      const x = parseFloat(line.substring(30, 38));
      const y = parseFloat(line.substring(38, 46));
      const resId = parseInt(line.substring(22, 26));

      if (isNaN(x) || isNaN(y) || isNaN(resId)) continue;

      if (atomName === "CA") {
        cAlpha.set(resId, { x, y, resName, resId });
      }
      if (atomName === "CB" || (atomName === "CA" && resName === "GLY")) {
        cBeta.set(resId, { x, y, resName, resId });
      }
    } catch {
      // skip unparseable lines
    }
  }

  return { cAlpha, cBeta };
}

// ── SVG rendering ──

const RADIUS = 1.2;
const MARGIN = 5.0;
const CB_FUDGE = 1.4;
const SCALE = 10;

interface BackboneViewerProps {
  peptideId: string;
  pdbUrl?: string;
}

export function BackboneViewer({ peptideId, pdbUrl }: BackboneViewerProps) {
  const [pdbText, setPdbText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const isValid = isValidUniProtAccession(peptideId);

  // Fetch PDB — first resolve URL from AlphaFold API, then download
  const fetchPdb = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = pdbUrl;
      if (!url) {
        // Resolve PDB URL from AlphaFold DB API
        const entry = await fetchAlphaFoldEntry(peptideId);
        if (!entry?.pdbUrl) {
          throw new Error("No AlphaFold structure available for this entry");
        }
        url = entry.pdbUrl;
      }
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`PDB fetch failed (${res.status})`);
      const text = await res.text();
      setPdbText(text);
      setVisible(true);
    } catch (err: any) {
      setError(err?.message ?? "Failed to fetch PDB");
    } finally {
      setLoading(false);
    }
  };

  const parsed = useMemo(() => {
    if (!pdbText) return null;
    return parsePDB(pdbText);
  }, [pdbText]);

  // Compute SVG geometry
  const svgData = useMemo(() => {
    if (!parsed || parsed.cAlpha.size === 0) return null;

    const { cAlpha, cBeta } = parsed;
    const cas = Array.from(cAlpha.values());
    const minx = Math.min(...cas.map((a) => a.x)) - MARGIN;
    const miny = Math.min(...cas.map((a) => a.y)) - MARGIN;
    const maxx = Math.max(...cas.map((a) => a.x)) + MARGIN;
    const maxy = Math.max(...cas.map((a) => a.y)) + MARGIN;

    const width = (maxx - minx) * SCALE;
    const height = (maxy - miny) * SCALE;

    // Main chain lines
    const sortedIds = Array.from(cAlpha.keys()).sort((a, b) => a - b);
    const mainChainLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (let i = 1; i < sortedIds.length; i++) {
      const prev = cAlpha.get(sortedIds[i - 1])!;
      const curr = cAlpha.get(sortedIds[i])!;
      // Only connect consecutive residues
      if (sortedIds[i] - sortedIds[i - 1] <= 1) {
        mainChainLines.push({ x1: curr.x, y1: curr.y, x2: prev.x, y2: prev.y });
      }
    }

    // Side chain circles
    const sideChains: Array<{
      cx: number;
      cy: number;
      lx: number;
      ly: number;
      resClass: ResidueClass;
      letter: string;
      resId: number;
      hasCb: boolean;
    }> = [];

    for (const [resId, cb] of cBeta.entries()) {
      const ca = cAlpha.get(resId);
      if (!ca) continue;

      let cx = cb.x;
      let cy = cb.y;
      const isGly = cb.resName === "GLY";

      if (!isGly) {
        cx = CB_FUDGE * cb.x + (1 - CB_FUDGE) * ca.x;
        cy = CB_FUDGE * cb.y + (1 - CB_FUDGE) * ca.y;
      }

      sideChains.push({
        cx,
        cy,
        lx: ca.x,
        ly: ca.y,
        resClass: RESIDUE_CLASS[cb.resName] ?? "n",
        letter: ONE_LETTER[cb.resName] ?? "?",
        resId,
        hasCb: !isGly,
      });
    }

    return { width, height, minx, miny, mainChainLines, sideChains, residueCount: cAlpha.size };
  }, [parsed]);

  if (!isValid) return null;

  return (
    <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-h3">2D Backbone</CardTitle>
            <CardDescription>
              AlphaFold-predicted backbone with color-coded residues
            </CardDescription>
          </div>
          {!visible && (
            <Button
              variant="outline"
              size="sm"
              className="btn-press"
              onClick={fetchPdb}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {loading ? "Loading..." : "Show 2D Backbone"}
            </Button>
          )}
        </div>
      </CardHeader>

      {error && (
        <CardContent className="pt-0">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      )}

      {visible && svgData && (
        <CardContent className="space-y-4">
          <div className="flex justify-center overflow-auto" data-chart-export>
            <svg
              viewBox={`0 0 ${svgData.width} ${svgData.height}`}
              className="w-full h-auto max-h-[500px]"
              style={{ maxWidth: Math.min(svgData.width, 800) }}
            >
              <g transform={`scale(${SCALE}) translate(${-svgData.minx}, ${-svgData.miny})`}>
                {/* Main chain */}
                {svgData.mainChainLines.map((l, i) => (
                  <line
                    key={`mc-${i}`}
                    x1={l.x1}
                    y1={l.y1}
                    x2={l.x2}
                    y2={l.y2}
                    stroke="hsl(var(--foreground))"
                    strokeWidth={0.4}
                    strokeOpacity={0.5}
                  />
                ))}

                {/* Side chains */}
                {svgData.sideChains.map((sc) => (
                  <g key={`sc-${sc.resId}`}>
                    {sc.hasCb && (
                      <line
                        x1={sc.cx}
                        y1={sc.cy}
                        x2={sc.lx}
                        y2={sc.ly}
                        stroke="hsl(var(--foreground))"
                        strokeWidth={0.2}
                        strokeOpacity={0.3}
                      />
                    )}
                    <circle
                      cx={sc.cx}
                      cy={sc.cy}
                      r={RADIUS}
                      fill={CLASS_COLORS[sc.resClass].fill}
                      stroke="hsl(var(--foreground))"
                      strokeWidth={0.15}
                      strokeOpacity={0.4}
                    >
                      <title>
                        {sc.letter}
                        {sc.resId} — {CLASS_COLORS[sc.resClass].label}
                      </title>
                    </circle>
                    <text
                      x={sc.cx}
                      y={sc.cy + RADIUS * 0.45}
                      textAnchor="middle"
                      fontSize={1.6}
                      fontFamily="sans-serif"
                      fill="hsl(var(--foreground))"
                      style={{ pointerEvents: "none" }}
                    >
                      {sc.letter}
                    </text>
                  </g>
                ))}

                {/* N-term / C-term labels */}
                {svgData.sideChains.length > 0 &&
                  (() => {
                    const first = svgData.sideChains[0];
                    const last = svgData.sideChains[svgData.sideChains.length - 1];
                    return (
                      <>
                        <text
                          x={first.cx}
                          y={first.cy - RADIUS - 0.8}
                          textAnchor="middle"
                          fontSize={1.4}
                          fontWeight="bold"
                          fill="#ef4444"
                        >
                          N
                        </text>
                        <text
                          x={last.cx}
                          y={last.cy - RADIUS - 0.8}
                          textAnchor="middle"
                          fontSize={1.4}
                          fontWeight="bold"
                          fill="#3b82f6"
                        >
                          C
                        </text>
                      </>
                    );
                  })()}
              </g>
            </svg>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
            {(
              Object.entries(CLASS_COLORS) as [ResidueClass, { fill: string; label: string }][]
            ).map(([cls, { fill, label }]) => (
              <div key={cls} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="inline-block w-3 h-3 rounded-full border border-border"
                  style={{ backgroundColor: fill }}
                />
                {label}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <ChartExportButtons filename={`${peptideId}-backbone-2d`} />
            <span className="text-xs text-muted-foreground">
              {svgData.residueCount} residues &middot; Based on atom2svg by @biochem_fan
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
