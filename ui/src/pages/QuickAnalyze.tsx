import { useState } from "react";
import { motion, cubicBezier } from "framer-motion";
import { FlaskConical, ChevronRight, Activity, ShieldCheck, LineChart } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

// Get API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// --- Shape of /api/predict response we actually use here ---
type PredictResponse = {
  Entry: string;
  Sequence: string;
  Length: number;
  Charge: number;
  Hydrophobicity: number;
  "Full length uH": number;
  "Beta full length uH": number;

  // Flags & FF
  sswPrediction: number;   // (-1 | 0 | 1) as number from backend
  chameleonPrediction?: number; // Backward compatibility alias (deprecated)
  ffHelixPercent: number;        // camelCase copy from server
  "FF-Helix (Jpred)": number;    // 1 or -1
};

// Simple helper: POST form-urlencoded to /api/predict
async function predictOne(sequence: string, entry?: string) {
  const form = new URLSearchParams();
  form.set("sequence", sequence.trim());
  if (entry?.trim()) form.set("entry", entry.trim());

  const res = await fetch(`${API_BASE_URL}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Predict failed (${res.status}): ${t || "unknown error"}`);
  }

  const json = (await res.json()) as Record<string, any>;

  // Normalize a couple of keys that the UI expects
  const ffHelixPercent =
    typeof json["FF Helix %"] === "number"
      ? json["FF Helix %"]
      : typeof json["ffHelixPercent"] === "number"
      ? json["ffHelixPercent"]
      : 0;

  const sswPrediction =
    typeof json["sswPrediction"] === "number"
      ? json["sswPrediction"]
      : typeof json["chameleonPrediction"] === "number" // Backward compat
      ? json["chameleonPrediction"]
      : typeof json["Chameleon"] === "number" // Legacy alias
      ? json["Chameleon"]
      : -1;

  const shaped: PredictResponse = {
    Entry: String(json["Entry"] ?? ""),
    Sequence: String(json["Sequence"] ?? ""),
    Length: Number(json["Length"] ?? 0),
    Charge: Number(json["Charge"] ?? 0),
    Hydrophobicity: Number(json["Hydrophobicity"] ?? 0),
    "Full length uH": Number(json["Full length uH"] ?? 0),
    "Beta full length uH": Number(json["Beta full length uH"] ?? 0),
    sswPrediction,
    chameleonPrediction: sswPrediction, // Backward compatibility alias
    ffHelixPercent,
    "FF-Helix (Jpred)": Number(json["FF-Helix (Jpred)"] ?? -1),
  };

  return shaped;
}

/** ---------- ScreenTransition (local, no extra files) ---------- */
type Phase = "idle" | "enter" | "exit";
function ScreenTransition({
  phase,
  clickPosition,
  onHalfway,
  onDone,
}: {
  phase: Phase;
  clickPosition: { x: number; y: number };
  onHalfway: () => void;
  onDone: () => void;
}) {
  if (phase === "idle") return null;

  // compute max radius so the circle covers the whole viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dx = Math.max(clickPosition.x, vw - clickPosition.x);
  const dy = Math.max(clickPosition.y, vh - clickPosition.y);
  const maxR = Math.sqrt(dx * dx + dy * dy);

  const isEntering = phase === "enter";
  const from = 0.0001;
  const to = maxR;

  return (
    <motion.div
      initial={{ clipPath: `circle(${from}px at ${clickPosition.x}px ${clickPosition.y}px)` }}
      animate={{ clipPath: `circle(${isEntering ? to : from}px at ${clickPosition.x}px ${clickPosition.y}px)` }}
      transition={{ duration: 0.6, ease: cubicBezier(0.22, 1, 0.36, 1) }}
      onUpdate={(latest) => {
        // fire halfway when radius crosses ~50%
        const m = /circle\((\d+\.?\d*)px/.exec(String((latest as any).clipPath));
        if (m) {
          const r = parseFloat(m[1]);
          if (isEntering && r > to * 0.5) {
            onHalfway();
          }
        }
      }}
      onAnimationComplete={onDone}
      style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}
      className="bg-background"
    />
  );
}

/** -------------------- Page -------------------- */
export default function QuickAnalyze() {
  const [sequence, setSequence] = useState("");
  const [entry, setEntry] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PredictResponse | null>(null);
  const navigate = useNavigate();

  // NEW: transition state
  const [phase, setPhase] = useState<Phase>("idle");
  const [clickPos, setClickPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sequence.trim()) {
      toast.error("Please paste an amino-acid sequence");
      return;
    }
    setLoading(true);
    setData(null);
    try {
      const res = await predictOne(sequence, entry);
      setData(res);
      toast.success("Prediction ready");
    } catch (err: any) {
      toast.error(err?.message || "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  const flagBadge = (v: number, label: string) => {
    if (v === 1) {
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">{label}: Positive</Badge>;
    } else if (v === -1) {
      return <Badge variant="outline">{label}: N/A</Badge>;
    } else {
      return <Badge variant="secondary">{label}: Negative</Badge>;
    }
  };

  const ffHelixDisplay = (percent: number) => {
    if (percent === -1 || percent === undefined) {
      return <Badge variant="outline">FF-Helix: N/A</Badge>;
    } else if (percent > 0) {
      return <Badge className="bg-blue-600 hover:bg-blue-600">FF-Helix: {percent.toFixed(1)}%</Badge>;
    } else {
      return <Badge variant="secondary">FF-Helix: 0%</Badge>;
    }
  };

  return (
    <>
      {/* TRANSITION OVERLAY */}
      <ScreenTransition
        phase={phase}
        clickPosition={clickPos}
        onHalfway={() => {
          // navigate at the midpoint of the animation
          navigate("/upload");
          setPhase("exit");
        }}
        onDone={() => setPhase("idle")}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: cubicBezier(0.22, 1, 0.36, 1) }}
        className="max-w-4xl mx-auto p-6"
      >
        <div className="max-w-5xl mx-auto p-6 space-y-8">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold">Quick Analyze (single peptide)</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Paste a sequence (A–Z amino-acid letters)</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="md:col-span-3">
                    <Label htmlFor="seq">Sequence</Label>
                    <Input
                      id="seq"
                      value={sequence}
                      onChange={(e) => setSequence(e.target.value)}
                      placeholder="e.g. MRWQEMGYIFYPRKLR"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Label htmlFor="entry">Label (optional)</Label>
                    <Input
                      id="entry"
                      value={entry}
                      onChange={(e) => setEntry(e.target.value)}
                      placeholder="e.g. custom-1"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Analyzing…" : "Analyze"}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>

                  {/* UPDATED: radial transition to /upload */}
                  <Button
                    variant="ghost"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setClickPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                      setPhase("enter");
                    }}
                  >
                    Batch mode
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {data && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Left: Identity & Flags */}
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      Result
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-muted-foreground">Entry</div>
                    <div className="font-mono">{data.Entry}</div>

                    <div className="text-sm text-muted-foreground mt-2">Length</div>
                    <div className="font-medium">{data.Length} aa</div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {flagBadge(data.sswPrediction ?? data.chameleonPrediction, "SSW")}
                      {ffHelixDisplay(data.ffHelixPercent)}
                      {flagBadge(data["FF-Helix (Jpred)"], "JPred")}
                    </div>
                  </CardContent>
                </Card>

                {/* Middle: KPIs */}
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Biochemical KPIs
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Charge</div>
                      <div className="text-xl font-semibold">{data.Charge.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Hydrophobicity (H)</div>
                      <div className="text-xl font-semibold">{data.Hydrophobicity.toFixed(3)}</div>
                    </div>
                    {/* Removed hydrophobic moment (μH) from single-sequence view - not meaningful for individual peptides */}
                    {/* μH is more useful in batch comparisons, not single-sequence analysis */}
                  </CardContent>
                </Card>

                {/* Right: Guidance */}
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LineChart className="h-5 w-5" />
                      Interpretation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      <strong>Charge</strong> and <strong>hydrophobicity</strong> help screen antimicrobial and
                      amyloid-prone candidates. Higher hydrophobicity with positive charge can suggest membrane activity.
                    </p>
                    <p>
                      <strong>Hydrophobicity</strong> measures peptide's preference for nonpolar environments; higher values often align with
                      helical segments and membrane activity.
                    </p>
                    <p className="text-muted-foreground">
                      JPred/Tango columns will read "not available" if those providers aren't wired for single-sequence
                      runs on your machine.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Sequence box */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Sequence</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-sm break-all">{data.Sequence}</div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </motion.div>
    </>
  );
}
