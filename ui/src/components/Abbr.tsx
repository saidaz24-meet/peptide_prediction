import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function Abbr({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="underline decoration-dotted cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipContent><p>{title}</p></TooltipContent>
    </Tooltip>
  );
}
