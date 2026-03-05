/**
 * Reusable colored progress bar for 0-100 percentile scores.
 *
 * Colors: green (≥66), amber (33-66), red (<33)
 */

interface ScoreBarProps {
  score: number;          // 0-100
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function ScoreBar({ score, size = 'sm', showLabel = true }: ScoreBarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    clamped >= 66 ? 'bg-green-500' :
    clamped >= 33 ? 'bg-amber-500' :
    'bg-red-500';

  const h = size === 'md' ? 'h-3' : 'h-2';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${h} rounded-full bg-muted overflow-hidden min-w-[60px]`}>
        <div
          className={`${h} rounded-full ${color} transition-all duration-300`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-mono tabular-nums w-7 text-right">
          {Math.round(clamped)}
        </span>
      )}
    </div>
  );
}
