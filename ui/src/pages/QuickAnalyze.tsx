import { useState } from "react";
import { motion } from "framer-motion";
import { FlaskConical, ChevronRight, Activity, ShieldCheck, LineChart } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

// Simple helper: POST form-urlencoded to /api/predict
async function predictOne(sequence: string, entry?: string) {
  const form = new URLSearchParams();
  form.set("sequence", sequence.trim());
  if (entry?.trim()) form.set("entry", entry.trim());
  const res = await fetch("http://127.0.0.1:8000/api/predict", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Predict failed (${res.status}): ${t || "unknown error"}`);
  }
  return (await res.json()) as {
    Entry: string;
    Sequence: string;
    Length: number;
    Charge: number;
    Hydrophobicity: number;
    "Full length uH": number;
    "Helix (Jpred) uH": number; // -1 if not available
    "Beta full length uH": number;
    "FF-Secondary structure switch": number; // 1 or -1
    "FF-Helix (Jpred)": number; // 1 or -1
  };
}

export default function QuickAnalyze() {
  const [sequence, setSequence] = useState("");
  const [entry, setEntry] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof predictOne>> | null>(null);
  const navigate = useNavigate();

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

  const flagBadge = (v: number) =>
    v === 1 ? (
      <Badge className="bg-emerald-600 hover:bg-emerald-600">Flag: Positive</Badge>
    ) : (
      <Badge variant="secondary">Flag: Negative</Badge>
    );

  const availability = (v: number) =>
    v === -1 ? <Badge variant="outline">JPred: not available</Badge> : <Badge>JPred: on</Badge>;

  return (
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
              <Button variant="ghost" onClick={() => navigate("/upload")}>
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
                  {flagBadge(data["FF-Secondary structure switch"])}
                  {flagBadge(data["FF-Helix (Jpred)"])}
                  {availability(data["Helix (Jpred) uH"])}
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
                <div>
                  <div className="text-sm text-muted-foreground">μH (full length)</div>
                  <div className="text-xl font-semibold">{data["Full length uH"].toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">β μH (full length)</div>
                  <div className="text-xl font-semibold">{data["Beta full length uH"].toFixed(3)}</div>
                </div>
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
                  <strong>μH</strong> (hydrophobic moment) summarizes amphipathicity; higher values often align with
                  helical segments. <strong>β μH</strong> uses a 160° angle for β-like profiles.
                </p>
                <p className="text-muted-foreground">
                  JPred/Tango columns will read “not available” if those providers aren’t wired for single-sequence
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
  );
}
