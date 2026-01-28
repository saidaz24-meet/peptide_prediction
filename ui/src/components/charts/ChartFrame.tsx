import { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';

interface ChartFrameProps {
  fixedWidth?: number;
  fixedHeight?: number;
  children: ReactNode;
}

/**
 * ChartFrame: Wrapper for Recharts charts that handles fixed vs responsive dimensions.
 * 
 * When width/height are fixed numbers, do not wrap in ResponsiveContainer (avoids Recharts warnings).
 * When width/height are percentages or undefined, use ResponsiveContainer.
 * 
 * Usage:
 *   <ChartFrame fixedWidth={800} fixedHeight={400}>
 *     <BarChart>...</BarChart>
 *   </ChartFrame>
 * 
 *   <ChartFrame>  {/* Uses ResponsiveContainer with 100% width/height */}
 *     <BarChart>...</BarChart>
 *   </ChartFrame>
 */
export function ChartFrame({ fixedWidth, fixedHeight, children }: ChartFrameProps) {
  // If both width and height are fixed numbers, render without ResponsiveContainer
  if (fixedWidth && fixedHeight && typeof fixedWidth === 'number' && typeof fixedHeight === 'number') {
    return (
      <div style={{ width: fixedWidth, height: fixedHeight }}>
        {children}
      </div>
    );
  }
  
  // Otherwise, use ResponsiveContainer (default behavior)
  return (
    <ResponsiveContainer width="100%" height="100%">
      {children}
    </ResponsiveContainer>
  );
}

