# Ticket 002: Provider Status Visibility

**Date**: 2024-01-14  
**Phase**: 1.2  
**Priority**: High  
**Status**: Open

## Background

The backend already returns `providerStatus` in API responses (see `backend/services/provider_tracking.py`), but the frontend doesn't display it. Users can't see whether TANGO/PSIPRED are ON/OFF or how many hits were found.

This ticket adds provider status visibility throughout the UI.

## Goal

Show provider status (TANGO/PSIPRED ON/OFF + hit counts) in:
1. Results page header (status pills)
2. Peptide detail page (status in header)
3. CSV export (provider status column)

## Exact Edits

### Frontend: Type Definition

**File**: `ui/src/types/peptide.ts`

**Add provider status type**:

```typescript
export interface ProviderStatus {
  tango?: {
    status: "ON" | "OFF" | "UNAVAILABLE";
    hitCount?: number;
    skippedReason?: string;
  };
  psipred?: {
    status: "ON" | "OFF" | "UNAVAILABLE";
    hitCount?: number;
    skippedReason?: string;
  };
  jpred?: {
    status: "ON" | "OFF" | "UNAVAILABLE";
    hitCount?: number;
    skippedReason?: string;
  };
}

export interface Peptide {
  // ... existing fields ...
  providerStatus?: ProviderStatus;
}
```

### Frontend: Mapper Update

**File**: `ui/src/lib/mappers.ts`

**Update `mapBackendRowToPeptide`**:

```typescript
export function mapBackendRowToPeptide(row: Record<string, any>): Peptide {
  // ... existing mapping code ...
  
  const peptide: Peptide = {
    // ... existing fields ...
    
    // Provider status (from backend)
    providerStatus: row.providerStatus || row.provider_status || undefined,
  };
  
  return peptide;
}
```

### Frontend: Provider Status Badge Component

**File**: `ui/src/components/ProviderStatusBadge.tsx` (new)

```typescript
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { ProviderStatus } from "@/types/peptide";

interface ProviderStatusBadgeProps {
  provider: "tango" | "psipred" | "jpred";
  status: ProviderStatus;
}

export function ProviderStatusBadge({ provider, status }: ProviderStatusBadgeProps) {
  const providerData = status[provider];
  if (!providerData) return null;
  
  const { status: providerStatus, hitCount, skippedReason } = providerData;
  
  let icon, label, variant: "default" | "secondary" | "destructive";
  
  if (providerStatus === "ON") {
    icon = <CheckCircle className="w-3 h-3 mr-1" />;
    label = `${provider.toUpperCase()}: ON`;
    variant = "default";
    if (hitCount !== undefined) {
      label += ` (${hitCount} hits)`;
    }
  } else if (providerStatus === "OFF") {
    icon = <XCircle className="w-3 h-3 mr-1" />;
    label = `${provider.toUpperCase()}: OFF`;
    variant = "secondary";
  } else {
    icon = <AlertCircle className="w-3 h-3 mr-1" />;
    label = `${provider.toUpperCase()}: UNAVAILABLE`;
    variant = "destructive";
    if (skippedReason) {
      label += ` (${skippedReason})`;
    }
  }
  
  return (
    <Badge variant={variant} className="flex items-center">
      {icon}
      {label}
    </Badge>
  );
}
```

### Frontend: Results Page Integration

**File**: `ui/src/pages/Results.tsx`

**Add provider status pills** (in header, after KPIs):

```typescript
import { ProviderStatusBadge } from "@/components/ProviderStatusBadge";

// In Results component, after stats calculation:
const providerStatus = peptides.length > 0 ? peptides[0].providerStatus : undefined;

// In render, add after KPIs:
{providerStatus && (
  <div className="flex gap-2 flex-wrap">
    {providerStatus.tango && (
      <ProviderStatusBadge provider="tango" status={providerStatus} />
    )}
    {providerStatus.psipred && (
      <ProviderStatusBadge provider="psipred" status={providerStatus} />
    )}
    {providerStatus.jpred && (
      <ProviderStatusBadge provider="jpred" status={providerStatus} />
    )}
  </div>
)}
```

### Frontend: Peptide Detail Page Integration

**File**: `ui/src/pages/PeptideDetail.tsx`

**Add provider status** (in header, after peptide name):

```typescript
import { ProviderStatusBadge } from "@/components/ProviderStatusBadge";

// In render, add after peptide name:
{peptide.providerStatus && (
  <div className="flex gap-2 mt-2">
    {peptide.providerStatus.tango && (
      <ProviderStatusBadge provider="tango" status={peptide.providerStatus} />
    )}
    {peptide.providerStatus.psipred && (
      <ProviderStatusBadge provider="psipred" status={peptide.providerStatus} />
    )}
    {peptide.providerStatus.jpred && (
      <ProviderStatusBadge provider="jpred" status={peptide.providerStatus} />
    )}
  </div>
)}
```

### Frontend: CSV Export Update

**File**: `ui/src/pages/Results.tsx`

**Update `exportShortlistCSV`** to include provider status:

```typescript
function exportShortlistCSV() {
  const cols = [
    "id", "name", "sequence", "length",
    "hydrophobicity", "charge", "muH",
    "sswPrediction", "sswScore",
    "ffHelixPercent",
    // Add provider status columns
    "tangoStatus", "psipredStatus", "jpredStatus",
  ];
  
  const rows = shortlist.map((p) =>
    cols.map((c) => {
      if (c === "tangoStatus") {
        return p.providerStatus?.tango?.status || "N/A";
      }
      if (c === "psipredStatus") {
        return p.providerStatus?.psipred?.status || "N/A";
      }
      if (c === "jpredStatus") {
        return p.providerStatus?.jpred?.status || "N/A";
      }
      // ... existing mapping ...
    })
  );
  
  // ... rest of export logic ...
}
```

## Test Steps

1. **Upload CSV with TANGO enabled**:
   - Set `USE_TANGO=1` in `.env`
   - Upload CSV → Results page shows "TANGO: ON (50 hits)" badge

2. **Disable TANGO**:
   - Set `USE_TANGO=0` in `.env`
   - Restart backend → Upload CSV → Results page shows "TANGO: OFF" badge

3. **TANGO fails**:
   - Set invalid TANGO path → Upload CSV → Results page shows "TANGO: UNAVAILABLE (reason)"

4. **Peptide detail**:
   - Click peptide → Detail page shows provider status badges

5. **CSV export**:
   - Export CSV → Verify `tangoStatus`, `psipredStatus`, `jpredStatus` columns exist

## Acceptance Criteria

- ✅ Upload CSV → Results page shows "TANGO: ON (50 hits)" pill
- ✅ Disable TANGO (`USE_TANGO=0`) → Results page shows "TANGO: OFF"
- ✅ Peptide detail page shows provider status in header
- ✅ Export CSV includes provider status columns

## Demo Steps

1. Upload dataset → show provider status pills in Results header
2. Click peptide → show provider status in detail page
3. Toggle `USE_TANGO=0` in `.env` → restart → show "TANGO: OFF" status

## Related Tickets

- Ticket 001: UniProt Pipeline (provider status shown in results)
- Ticket 003: Enhanced Observability (logs provider status changes)

