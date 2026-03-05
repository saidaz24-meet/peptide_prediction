import { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Upload,
  Zap,
  BarChart3,
  HelpCircle,
  Info,
  PanelLeft,
  FlaskConical,
  Home,
  GitCompareArrows,
  FilePlus2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDatasetStore } from '@/stores/datasetStore';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/upload', label: 'Upload', icon: Upload },
  { path: '/quick', label: 'Quick Analyze', icon: Zap },
  { path: '/results', label: 'Results', icon: BarChart3 },
  { path: '/compare', label: 'Compare', icon: GitCompareArrows },
  { path: '/help', label: 'Help', icon: HelpCircle },
  { path: '/about', label: 'About', icon: Info },
] as const;

function NavContent({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const resetData = useDatasetStore((s) => s.resetData);

  const handleClick = useCallback(
    (path: string) => {
      navigate(path);
      onNavigate?.();
    },
    [navigate, onNavigate],
  );

  const handleNewAnalysis = useCallback(() => {
    resetData();
    navigate('/upload');
    onNavigate?.();
  }, [resetData, navigate, onNavigate]);

  return (
    <nav className="flex flex-col gap-1 px-2">
      {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
        const isActive =
          path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path);

        const button = (
          <button
            key={path}
            onClick={() => handleClick(path)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full text-left',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              collapsed && 'justify-center px-2',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </button>
        );

        if (collapsed) {
          return (
            <Tooltip key={path}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        }

        return button;
      })}

      {/* Separator + New Analysis */}
      <div className="mt-3 pt-3 border-t">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleNewAnalysis}
                className="flex items-center justify-center rounded-lg px-2 py-2 text-sm font-medium transition-colors w-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <FilePlus2 className="h-4 w-4 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">New Analysis</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={handleNewAnalysis}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full text-left text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <FilePlus2 className="h-4 w-4 shrink-0" />
            <span>New Analysis</span>
          </button>
        )}
      </div>
    </nav>
  );
}

export function AppSidebar() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("pvl-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("pvl-sidebar-collapsed", String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const [mobileOpen, setMobileOpen] = useState(false);

  // Mobile: use Sheet (slide-out drawer)
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-3 left-3 z-40 md:hidden"
            aria-label="Open navigation"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 pt-10">
          <div className="flex items-center gap-2 px-4 pb-4 border-b">
            <FlaskConical className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Peptide Visual Lab</span>
          </div>
          <div className="pt-4">
            <NavContent
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: collapsible sidebar
  return (
    <aside
      className={cn(
        'sticky top-0 h-screen border-r bg-sidebar flex flex-col transition-[width] duration-200 shrink-0 z-30',
        collapsed ? 'w-14' : 'w-52',
      )}
    >
      {/* Logo / brand */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-4 border-b',
          collapsed && 'justify-center',
        )}
      >
        <FlaskConical className="h-5 w-5 text-primary shrink-0" />
        {!collapsed && (
          <span className="font-semibold text-sm truncate">PVL</span>
        )}
      </div>

      {/* Nav links */}
      <div className="flex-1 py-4 overflow-y-auto">
        <NavContent collapsed={collapsed} />
      </div>

      {/* Collapse toggle */}
      <div className="border-t p-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-full"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <PanelLeft
                className={cn(
                  'h-4 w-4 transition-transform',
                  collapsed && 'rotate-180',
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? 'Expand' : 'Collapse'}
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
