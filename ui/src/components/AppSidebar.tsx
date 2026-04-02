import { useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Upload,
  Zap,
  BarChart3,
  HelpCircle,
  Info,
  FlaskConical,
  Home,
  GitCompareArrows,
  Database,
  FilePlus2,
  Moon,
  Sun,
  Loader2,
  X,
  PanelLeft,
} from "lucide-react";
import { useDatasetStore } from "@/stores/datasetStore";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { checkNavGuard } from "@/hooks/use-nav-guard";
import { useJobStore } from "@/stores/jobStore";
import { STAGE_LABELS } from "@/lib/jobApi";

type SidebarMode = "hover" | "expanded" | "collapsed";

const NAV_ITEMS = [
  { path: "/", label: "Home", icon: Home },
  { path: "/upload", label: "Upload", icon: Upload },
  { path: "/search", label: "Database Search", icon: Database },
  { path: "/quick", label: "Quick Analyze", icon: Zap },
  { path: "/results", label: "Results", icon: BarChart3 },
  { path: "/compare", label: "Compare", icon: GitCompareArrows },
  { path: "/help", label: "Help", icon: HelpCircle },
  { path: "/about", label: "About", icon: Info },
] as const;

/** Read the current theme from the DOM */
function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** Toggle between dark and light mode */
function toggleTheme(): boolean {
  const goingLight = isDarkMode();
  if (goingLight) {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("pvl-theme", "light");
  } else {
    document.documentElement.classList.add("dark");
    localStorage.setItem("pvl-theme", "dark");
  }
  return !goingLight;
}

function ThemeToggleButton({ showLabel }: { showLabel: boolean }) {
  const [dark, setDark] = useState(isDarkMode);

  const handleToggle = () => {
    const newDark = toggleTheme();
    setDark(newDark);
  };

  const Icon = dark ? Moon : Sun;
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleToggle}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-small font-medium transition-colors duration-150 w-full text-left text-muted-foreground hover:bg-[hsl(var(--surface-2))] hover:text-foreground"
          aria-label={label}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span
            className={cn(
              "whitespace-nowrap transition-opacity duration-150",
              showLabel ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
            )}
          >
            Theme
          </span>
        </button>
      </TooltipTrigger>
      {!showLabel && <TooltipContent side="right">{label}</TooltipContent>}
    </Tooltip>
  );
}

function NavContent({ showLabels, onNavigate }: { showLabels: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const resetData = useDatasetStore((s) => s.resetData);

  const handleClick = useCallback(
    (path: string) => {
      if (checkNavGuard(path)) return;
      navigate(path);
      onNavigate?.();
    },
    [navigate, onNavigate]
  );

  const handleNewAnalysis = useCallback(() => {
    if (checkNavGuard("/upload")) return;
    resetData();
    navigate("/upload");
    onNavigate?.();
  }, [resetData, navigate, onNavigate]);

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
        const isActive =
          path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

        const button = (
          <button
            key={path}
            onClick={() => handleClick(path)}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-small font-medium transition-colors duration-150 w-full text-left relative",
              isActive
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:bg-[hsl(var(--surface-2))] hover:text-foreground"
            )}
          >
            {/* Active indicator bar */}
            {isActive && showLabels && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
            )}
            <Icon
              className={cn("h-4 w-4 shrink-0 transition-colors", isActive && "text-primary")}
            />
            <span
              className={cn(
                "whitespace-nowrap transition-opacity duration-150",
                showLabels ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              )}
            >
              {label}
            </span>
          </button>
        );

        if (!showLabels) {
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
      <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleNewAnalysis}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-small font-medium transition-colors duration-150 w-full text-left text-primary hover:bg-primary/10"
            >
              <FilePlus2 className="h-4 w-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-opacity duration-150",
                  showLabels ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                )}
              >
                New Analysis
              </span>
            </button>
          </TooltipTrigger>
          {!showLabels && <TooltipContent side="right">New Analysis</TooltipContent>}
        </Tooltip>
      </div>

      {/* Active job indicator */}
      <JobIndicator showLabels={showLabels} />
    </nav>
  );
}

/** Shows running job status in the sidebar */
function JobIndicator({ showLabels }: { showLabels: boolean }) {
  const jobs = useJobStore((s) => s.jobs);
  const cancelJob = useJobStore((s) => s.cancelJob);

  const activeJobs = Object.values(jobs).filter(
    (j) => j.status !== "SUCCESS" && j.status !== "FAILURE" && j.status !== "REVOKED"
  );

  if (activeJobs.length === 0) return null;

  const job = activeJobs[0];
  const stageLabel = job.progress?.stage
    ? STAGE_LABELS[job.progress.stage] || job.progress.stage
    : "Starting...";
  const percent = job.progress?.percent ?? 0;

  if (!showLabels) {
    return (
      <div className="mt-2 px-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center rounded-lg py-2 text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            {activeJobs.length} analysis running — {percent}%
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="mt-3 mx-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="text-[11px] font-medium text-primary">Analyzing</span>
        </div>
        <button
          onClick={() => cancelJob(job.jobId)}
          className="text-muted-foreground hover:text-destructive transition-colors"
          title="Cancel analysis"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="text-[10px] text-muted-foreground truncate mb-1">{stageLabel}</div>
      <div className="h-1 rounded-full bg-primary/10 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${Math.min(95, percent)}%` }}
        />
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">
        {job.peptideCount} peptides · {percent}%
      </div>
    </div>
  );
}

/** Animated hamburger → X icon */
function HamburgerIcon({ open }: { open: boolean }) {
  const barClass = "block h-[2px] rounded-full bg-current transition-all duration-300 ease-in-out";
  return (
    <div className="w-5 h-4 flex flex-col justify-between text-foreground">
      <span
        className={cn(barClass, "w-5", open && "translate-y-[7px] rotate-45")}
        style={{
          background: "currentColor",
          backgroundImage: open
            ? "none"
            : "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: open ? "auto" : "4px 2px",
        }}
      />
      <span
        className={cn(barClass, "w-4", open && "opacity-0 scale-x-0")}
        style={{
          background: "currentColor",
          backgroundImage: open
            ? "none"
            : "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: open ? "auto" : "4px 2px",
        }}
      />
      <span
        className={cn(barClass, "w-5", open && "-translate-y-[7px] -rotate-45")}
        style={{
          background: "currentColor",
          backgroundImage: open
            ? "none"
            : "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: open ? "auto" : "4px 2px",
        }}
      />
    </div>
  );
}

/** Shows current page title in mobile top bar */
function MobilePageTitle() {
  const location = useLocation();

  if (location.pathname.startsWith("/peptides/")) {
    const id = location.pathname.split("/peptides/")[1];
    return (
      <div className="flex items-center gap-2 min-w-0">
        <FlaskConical className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground truncate">{id || "Peptide"}</span>
      </div>
    );
  }
  if (location.pathname.startsWith("/metrics/")) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <BarChart3 className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground truncate">Metric Detail</span>
      </div>
    );
  }

  const match = NAV_ITEMS.find((item) =>
    item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path)
  );
  const title = match?.label ?? "PVL";
  const Icon = match?.icon ?? FlaskConical;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-semibold text-foreground truncate">{title}</span>
    </div>
  );
}

/** Sidebar mode selector — tiny icon at bottom-right like Supabase */
function SidebarModeSelector({
  mode,
  onModeChange,
  showLabel,
}: {
  mode: SidebarMode;
  onModeChange: (m: SidebarMode) => void;
  showLabel: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const labels: Record<SidebarMode, string> = {
    expanded: "Expanded",
    collapsed: "Collapsed",
    hover: "Expand on hover",
  };

  return (
    <div className="relative" ref={ref}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-small font-medium transition-colors duration-150 w-full text-left text-muted-foreground hover:bg-[hsl(var(--surface-2))] hover:text-foreground"
          >
            <PanelLeft className="h-4 w-4 shrink-0" />
            <span
              className={cn(
                "whitespace-nowrap transition-opacity duration-150",
                showLabel ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              )}
            >
              Sidebar
            </span>
          </button>
        </TooltipTrigger>
        {!showLabel && <TooltipContent side="right">Sidebar control</TooltipContent>}
      </Tooltip>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 z-50 bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-lg shadow-strong py-1 min-w-[160px]">
            <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Sidebar control
            </div>
            {(["expanded", "collapsed", "hover"] as SidebarMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  onModeChange(m);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs transition-colors",
                  mode === m
                    ? "text-primary bg-primary/5"
                    : "text-foreground hover:bg-[hsl(var(--surface-2))]"
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    mode === m ? "bg-primary" : "bg-transparent"
                  )}
                />
                {labels[m]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function AppSidebar() {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    try {
      return (localStorage.getItem("pvl-sidebar-mode") as SidebarMode) || "hover";
    } catch {
      return "hover";
    }
  });

  const handleModeChange = (m: SidebarMode) => {
    setSidebarMode(m);
    try {
      localStorage.setItem("pvl-sidebar-mode", m);
    } catch {
      /* ignore */
    }
  };

  // Determine if sidebar shows labels based on mode + hover state
  const showLabels =
    sidebarMode === "expanded" ? true : sidebarMode === "collapsed" ? false : hovered;

  // Mobile: fixed top bar + full-screen overlay nav
  if (isMobile) {
    return (
      <>
        <header className="fixed top-0 left-0 right-0 z-40 md:hidden h-12 bg-[hsl(var(--background))]/95 backdrop-blur-sm border-b border-[hsl(var(--border))] flex items-center px-3 gap-3">
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[hsl(var(--surface-2))] transition-colors"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          >
            <HamburgerIcon open={mobileOpen} />
          </button>
          <MobilePageTitle />
          <div className="ml-auto">
            <ThemeToggleButton showLabel={false} />
          </div>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMobileOpen(false)}>
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
            <nav
              className="absolute top-12 left-0 bottom-0 w-64 bg-[hsl(var(--background))] border-r border-[hsl(var(--border))] shadow-xl overflow-y-auto animate-slide-in-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[hsl(var(--border))]">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FlaskConical className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <span className="font-semibold text-small text-foreground">PVL</span>
                  <span className="block text-[10px] text-[hsl(var(--faint))] leading-none mt-0.5">
                    Peptide Visual Lab
                  </span>
                </div>
              </div>
              <div className="pt-4">
                <NavContent showLabels={true} onNavigate={() => setMobileOpen(false)} />
              </div>
              <div className="mt-auto border-t border-[hsl(var(--border))] p-2">
                <ThemeToggleButton showLabel={true} />
              </div>
            </nav>
          </div>
        )}
      </>
    );
  }

  // Desktop sidebar
  // "hover" mode: fixed narrow rail (w-14), overlay expands on hover
  // "expanded": always wide (w-52), pushes content
  // "collapsed": always narrow (w-14), icons only
  const isNarrow = sidebarMode === "collapsed" || (sidebarMode === "hover" && !hovered);
  const isOverlay = sidebarMode === "hover" && hovered;

  return (
    <>
      {/* Fixed-width spacer that always takes w-14 in the layout (hover/collapsed) or w-52 (expanded) */}
      <div
        className={cn("shrink-0 hidden md:block", sidebarMode === "expanded" ? "w-52" : "w-14")}
      />

      {/* The actual sidebar — positioned fixed so it overlays content on hover */}
      <aside
        onMouseEnter={() => sidebarMode === "hover" && setHovered(true)}
        onMouseLeave={() => sidebarMode === "hover" && setHovered(false)}
        className={cn(
          "fixed top-0 left-0 h-screen border-r border-[hsl(var(--border))] bg-[hsl(var(--sidebar-background))] flex flex-col z-30",
          "transition-[width] duration-200 ease-out",
          isOverlay && "shadow-strong",
          isNarrow ? "w-14" : "w-52"
        )}
      >
        {/* Logo / brand */}
        <div className="flex items-center gap-2.5 px-3 py-4 border-b border-[hsl(var(--border))]">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FlaskConical className="h-4 w-4 text-primary" />
          </div>
          <div
            className={cn(
              "overflow-hidden whitespace-nowrap transition-opacity duration-150",
              showLabels ? "opacity-100" : "opacity-0 w-0"
            )}
          >
            <span className="font-semibold text-small text-foreground">PVL</span>
            <span className="block text-[10px] text-[hsl(var(--faint))] leading-none mt-0.5 truncate">
              Peptide Visual Lab
            </span>
          </div>
        </div>

        {/* Nav links */}
        <div className="flex-1 py-4 overflow-y-auto">
          <NavContent showLabels={showLabels} />
        </div>

        {/* Footer: Theme toggle + Sidebar mode selector */}
        <div className="border-t border-[hsl(var(--border))] p-2 flex flex-col gap-0.5">
          <ThemeToggleButton showLabel={showLabels} />
          <SidebarModeSelector
            mode={sidebarMode}
            onModeChange={handleModeChange}
            showLabel={showLabels}
          />
        </div>
      </aside>
    </>
  );
}
