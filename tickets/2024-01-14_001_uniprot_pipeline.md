# Ticket 001: UniProt Query → Analysis Pipeline

**Date**: 2024-01-14  
**Phase**: 1.1  
**Priority**: High  
**Status**: Open

## Background

The UniProt query flow exists (`UniProtQueryInput.tsx`, `/api/uniprot/execute`) but is incomplete:
- Query parsing works (`/api/uniprot/parse`)
- UniProt API fetch works (`/api/uniprot/execute`)
- **Missing**: Windowing logic to convert protein sequences → peptides
- **Missing**: Integration with results page (redirect after windowing)

This ticket completes the pipeline: query → fetch → window → analyze → display.

## Goal

Complete the UniProt query flow so users can:
1. Query UniProt for a protein (e.g., "P53_HUMAN")
2. Window the protein sequence into peptides (configurable window/step size)
3. Automatically trigger analysis (TANGO/PSIPRED/biochem)
4. Redirect to results page with peptides loaded

## Exact Edits

### Backend: Windowing Service

**File**: `backend/services/uniprot.py` (new)

```python
from typing import List, Dict, Tuple
import re

def window_sequence(
    sequence: str,
    sequence_id: str,
    window_size: int = 20,
    step_size: int = 5
) -> List[Dict[str, any]]:
    """
    Window a protein sequence into overlapping peptides.
    
    Args:
        sequence: Protein sequence (uppercase, no spaces)
        sequence_id: UniProt ID (e.g., "P53_HUMAN")
        window_size: Peptide length (default: 20)
        step_size: Step size for sliding window (default: 5)
    
    Returns:
        List of peptides: [{id, name, sequence, start, end}]
    """
    peptides = []
    seq_clean = re.sub(r'[^A-Z]', '', sequence.upper())
    
    for i in range(0, len(seq_clean) - window_size + 1, step_size):
        peptide_seq = seq_clean[i:i + window_size]
        start = i + 1  # 1-indexed
        end = i + window_size
        
        peptides.append({
            "id": f"{sequence_id}_pep_{start}_{end}",
            "name": f"{sequence_id} ({start}-{end})",
            "sequence": peptide_seq,
            "start": start,
            "end": end,
            "protein_id": sequence_id,
        })
    
    return peptides

def window_sequences(
    sequences: List[Dict[str, str]],
    window_size: int = 20,
    step_size: int = 5
) -> List[Dict[str, any]]:
    """
    Window multiple protein sequences into peptides.
    
    Args:
        sequences: [{id, sequence}]
        window_size: Peptide length
        step_size: Step size
    
    Returns:
        List of all peptides from all sequences
    """
    all_peptides = []
    for seq_data in sequences:
        peptides = window_sequence(
            seq_data["sequence"],
            seq_data["id"],
            window_size,
            step_size
        )
        all_peptides.extend(peptides)
    return all_peptides
```

### Backend: API Endpoint

**File**: `backend/server.py`

**Add endpoint** (after `/api/uniprot/execute`):

```python
@app.post("/api/uniprot/window")
async def window_sequences_endpoint(request: WindowRequest):
    """
    Window protein sequences into peptides.
    
    Request body:
    {
        "sequences": [{"id": "P53_HUMAN", "sequence": "MEEPQSDPSV..."}],
        "windowSize": 20,
        "stepSize": 5
    }
    
    Response:
    {
        "peptides": [{"id": "...", "name": "...", "sequence": "...", "start": 1, "end": 20}]
    }
    """
    from services.uniprot import window_sequences
    
    peptides = window_sequences(
        request.sequences,
        request.windowSize,
        request.stepSize
    )
    
    log_info("uniprot_windowed", 
             sequences=len(request.sequences),
             peptides=len(peptides),
             window_size=request.windowSize,
             step_size=request.stepSize)
    
    return {"peptides": peptides}

class WindowRequest(BaseModel):
    sequences: List[Dict[str, str]]
    windowSize: int = 20
    stepSize: int = 5
```

**Modify `/api/uniprot/execute`** to return sequences in format expected by windowing:

```python
# In execute_uniprot_query(), after fetching from UniProt API:
# Ensure response includes sequences in format: [{"id": "...", "sequence": "..."}]
```

### Frontend: Windowing Component

**File**: `ui/src/components/UniProtQueryInput.tsx`

**Add windowing UI** (after sequence fetch):

```typescript
const [windowSize, setWindowSize] = useState(20);
const [stepSize, setStepSize] = useState(5);
const [windowing, setWindowing] = useState(false);

const handleWindowAndAnalyze = async () => {
  if (!sequences || sequences.length === 0) {
    toast.error("No sequences to window");
    return;
  }
  
  setWindowing(true);
  try {
    // Window sequences
    const windowResponse = await fetch(`${API_BASE}/api/uniprot/window`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sequences: sequences.map(s => ({ id: s.id, sequence: s.sequence })),
        windowSize,
        stepSize,
      }),
    });
    
    if (!windowResponse.ok) {
      throw new Error("Windowing failed");
    }
    
    const { peptides } = await windowResponse.json();
    
    // Convert to CSV format for upload
    const csvRows = peptides.map((p: any) => ({
      "Name": p.name,
      "Sequence": p.sequence,
      "Protein ID": p.protein_id,
      "Start": p.start,
      "End": p.end,
    }));
    
    // Trigger analysis via upload endpoint
    const formData = new FormData();
    const csvBlob = new Blob([
      "Name,Sequence,Protein ID,Start,End\n" +
      csvRows.map(r => `${r.Name},${r.Sequence},${r["Protein ID"]},${r.Start},${r.End}`).join("\n")
    ], { type: "text/csv" });
    formData.append("file", csvBlob, "uniprot_peptides.csv");
    
    const uploadResponse = await fetch(`${API_BASE}/api/upload-csv`, {
      method: "POST",
      body: formData,
    });
    
    if (!uploadResponse.ok) {
      throw new Error("Analysis failed");
    }
    
    const result = await uploadResponse.json();
    
    // Redirect to results page
    navigate("/results");
    
  } catch (error) {
    toast.error(`Error: ${error.message}`);
  } finally {
    setWindowing(false);
  }
};
```

**Add UI controls** (in render, after sequence display):

```tsx
{sequences && sequences.length > 0 && (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Window Size
        </label>
        <input
          type="number"
          value={windowSize}
          onChange={(e) => setWindowSize(parseInt(e.target.value))}
          min={5}
          max={50}
          className="w-full px-3 py-2 border rounded"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">
          Step Size
        </label>
        <input
          type="number"
          value={stepSize}
          onChange={(e) => setStepSize(parseInt(e.target.value))}
          min={1}
          max={windowSize}
          className="w-full px-3 py-2 border rounded"
        />
      </div>
    </div>
    <Button
      onClick={handleWindowAndAnalyze}
      disabled={windowing}
      className="w-full"
    >
      {windowing ? "Windowing & Analyzing..." : "Window & Analyze"}
    </Button>
  </div>
)}
```

### Frontend: Landing Page Integration

**File**: `ui/src/pages/Index.tsx`

**Add UniProt query button** (near "Example Dataset" button):

```tsx
<Button
  onClick={() => navigate("/uniprot")}
  variant="outline"
  className="w-full"
>
  Query UniProt
</Button>
```

**Add route** (in `ui/src/App.tsx`):

```tsx
<Route path="/uniprot" element={<UniProtQueryPage />} />
```

**Create page** (`ui/src/pages/UniProtQuery.tsx`):

```tsx
import { UniProtQueryInput } from "@/components/UniProtQueryInput";

export default function UniProtQueryPage() {
  return (
    <div className="min-h-screen bg-gradient-surface p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Query UniProt</h1>
        <UniProtQueryInput />
      </div>
    </div>
  );
}
```

## Test Steps

1. **Query UniProt**:
   ```bash
   curl -X POST http://localhost:8000/api/uniprot/execute \
     -H "Content-Type: application/json" \
     -d '{"query": "P53_HUMAN"}'
   ```
   Expected: Returns protein sequence

2. **Window sequences**:
   ```bash
   curl -X POST http://localhost:8000/api/uniprot/window \
     -H "Content-Type: application/json" \
     -d '{
       "sequences": [{"id": "P53_HUMAN", "sequence": "MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGPDEAPRMPEAAPPVAPAPAAPTPAAPAPAPSWPLSSSVPSQKTYQGSYGFRLGFLHSGTAKSVTCTYSPALNKMFCQLAKTCPVQLWVDSTPPPGTRVRAMAIYKQSQHMTEVVRRCPHHERCSDSDGLAPPQHLIRVEGNLRVEYLDDRNTFRHSVVVPYEPPEVGSDCTTIHYNYMCNSSCMGGMNRRPILTIITLEDSSGNLLGRNSFEVRVCACPGRDRRTEEENLRKKGEPHHELPPGSTKRALPNNTSSSPQPKKKPLDGEYFTLQIRGRERFEMFRELNEALELKDAQAGKEPGGSRAHSSHLKSKKGQSTSRHKKLMFKTEGPDSD"}],
       "windowSize": 20,
       "stepSize": 5
     }'
   ```
   Expected: Returns list of peptides

3. **UI Flow**:
   - Open app → click "Query UniProt"
   - Enter "P53_HUMAN" → click "Fetch"
   - Adjust window/step size → click "Window & Analyze"
   - Verify redirect to `/results` with peptides loaded

## Acceptance Criteria

- ✅ Query UniProt for "P53_HUMAN" → returns protein sequence
- ✅ Window sequence (20/5) → returns 50+ peptides
- ✅ Click "Window & Analyze" → redirects to `/results` with peptides loaded
- ✅ Results page shows all peptides with TANGO/PSIPRED results
- ✅ Logs show `{"event": "uniprot_windowed", "sequences": 1, "peptides": 50}`

## Demo Steps

1. Open app → click "Query UniProt" on landing page
2. Enter "P53_HUMAN" → click "Fetch"
3. Adjust windowing params (20/5) → click "Window & Analyze"
4. Show results page with peptides → click one to show detail

## Related Tickets

- Ticket 002: Provider Status Visibility (shows TANGO/PSIPRED status in results)
- Ticket 003: Enhanced Observability (logs windowing events)

