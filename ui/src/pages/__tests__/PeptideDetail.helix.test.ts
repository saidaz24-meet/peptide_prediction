/**
 * Static contract test for HELIX_PERCENTAGE_AUDIT.md fix #3.
 *
 * PeptideDetail.tsx's "Sequence & Structure" legend used to read a phantom
 * field `peptide.helixPercent` and silently coerce nulls to 0% via `?? 0`.
 * The fix removes the phantom read and hides the legend block when
 * S4PRED data is unavailable.
 *
 * A full render test for PeptideDetail would require mocking ~10 heavy
 * children (AlphaFold viewer, backbone viewer, sliding-window profile,
 * router, dataset store), so this test enforces the invariant at the
 * source level instead. If the file is reformatted or refactored this
 * test still passes as long as the audit rule is preserved.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PEPTIDE_DETAIL_PATH = resolve(__dirname, "../PeptideDetail.tsx");
const PEPTIDE_TYPE_PATH = resolve(__dirname, "../../types/peptide.ts");

describe("PeptideDetail canonical-helix-only invariant", () => {
  const detailSrc = readFileSync(PEPTIDE_DETAIL_PATH, "utf-8");
  const typeSrc = readFileSync(PEPTIDE_TYPE_PATH, "utf-8");

  it("does not read peptide.helixPercent (phantom field)", () => {
    expect(detailSrc).not.toMatch(/peptide\.helixPercent\b/);
  });

  it("does not declare a `helixPercent?` field on the Peptide type", () => {
    // The whole-line `helixPercent?: number | null;` line was removed by fix #3.
    expect(typeSrc).not.toMatch(/^\s*helixPercent\?:/m);
  });

  it("does not silently substitute 0% for null helix percentages", () => {
    // Before the fix the legend rendered `(peptide.s4predHelixPercent ?? peptide.helixPercent ?? 0).toFixed(0)%`.
    // Both fallbacks must be gone.
    expect(detailSrc).not.toMatch(/s4predHelixPercent\s*\?\?\s*peptide\.helixPercent/);
    expect(detailSrc).not.toMatch(/s4predHelixPercent\s*\?\?\s*0\)\.toFixed/);
  });

  it("guards the S4PRED composition legend on s4predHelixPercent presence", () => {
    // 2026-06-08: PeptideDetail.tsx hardened the guard from `!= null` to
    // `typeof === "number"`. Either form satisfies the invariant — the
    // composition legend must NOT render when s4predHelixPercent is absent.
    const hasNullGuard = /peptide\.s4predHelixPercent\s*!=\s*null/.test(detailSrc);
    const hasTypeGuard = /typeof\s+peptide\.s4predHelixPercent\s*===\s*"number"/.test(
      detailSrc
    );
    expect(hasNullGuard || hasTypeGuard).toBe(true);
  });
});
