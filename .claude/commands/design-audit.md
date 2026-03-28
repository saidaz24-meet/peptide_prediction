---
name: design-audit
description: "Full UI/UX audit for PVL: data accuracy, visualization quality, responsiveness, accessibility"
arguments: "[page or component name, or 'all']"
---

# PVL Design Audit

## Steps

1. **Identify scope** — Which page(s) to audit (Results, PeptideDetail, PeptideTable, Compare, etc.)

2. **Data accuracy audit**:
   - [ ] Values match backend API response exactly
   - [ ] Null handling correct (`??` not `||`)
   - [ ] SSW values display correctly (-1, 0, 1, null)
   - [ ] FF data shown alongside SSW/S4PRED data
   - [ ] Thresholds update visualization correctly

3. **Visualization quality**:
   - [ ] Charts use Recharts with ResponsiveContainer
   - [ ] Tooltips on all data points
   - [ ] Colorblind-safe palette
   - [ ] Axes labeled clearly
   - [ ] Legend present and accurate
   - [ ] Publication-ready appearance

4. **Responsive audit**:
   - [ ] Desktop (1440px)
   - [ ] Tablet (768px)
   - [ ] No overflow or clipped content

5. **Accessibility**:
   - [ ] Keyboard navigable
   - [ ] Screen reader compatible
   - [ ] Sufficient color contrast

6. **Compare against reference screenshots** in `docs/` if available

## Output

```
## PVL Design Audit — [scope]

### Data Accuracy Issues
- [issue] — [file] — [fix]

### Visualization Issues
- [issue] — [file] — [fix]

### Missing FF Coverage
- [component] — shows [X] but missing [FF equivalent]

### Score
Data Accuracy: X/10
Visualization: X/10
Responsive: X/10
Accessibility: X/10
```
