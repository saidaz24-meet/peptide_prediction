/**
 * Chart drill-down inspector placeholder.
 *
 * Design philosophy: minimal stub that will be wired to actual chart
 * components later. Shows the metric name and a "coming soon" message.
 */

import { getMetric } from "@/lib/metricRegistry";

interface ChartInspectorProps {
  metricId: string;
}

export function ChartInspector({ metricId }: ChartInspectorProps) {
  const metric = getMetric(metricId);
  const title = metric?.name ?? metricId;

  return (
    <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Full chart view coming soon. This panel will render an expanded,
        interactive version of the selected chart.
      </p>
    </div>
  );
}
