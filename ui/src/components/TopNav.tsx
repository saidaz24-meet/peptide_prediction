/** TopNav — Stripe-style top bar for the landing page. Transparent → frosted glass on scroll. */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Moon, Sun, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/* Theme helpers (same logic as AppSidebar — keep in sync) */
function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}
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

const NAV_LINKS = [
  { label: "Quick Analyze", href: "/quick", isRoute: true },
  { label: "Upload", href: "/upload", isRoute: true },
  { label: "Help", href: "/help", isRoute: true },
  { label: "About", href: "/about", isRoute: true },
] as const;

interface TopNavProps { className?: string }

export function TopNav({ className }: TopNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setDark(isDarkMode()); }, []);

  const handleToggle = () => setDark(toggleTheme());
  const closeMobile = () => setMobileOpen(false);
  const ThemeIcon = dark ? Sun : Moon;
  const themeLabel = dark ? "Switch to light mode" : "Switch to dark mode";

  const ctaClass = cn(
    "inline-flex items-center gap-1.5 rounded-lg text-sm font-medium transition-colors",
    "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary-hover))]",
  );
  const linkClass = cn(
    "text-sm font-medium transition-colors",
    "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
  );
  const iconBtnClass = cn(
    "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
    "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]",
  );

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-200 ease-out",
          scrolled
            ? "border-b shadow-sm bg-[hsl(var(--background)/0.8)] backdrop-blur-xl border-[hsl(var(--border)/0.5)]"
            : "bg-transparent border-b border-transparent",
          className,
        )}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          {/* Logo */}
          <Link to="/" className="flex flex-col leading-none shrink-0">
            <span className="text-xl font-bold tracking-tight text-[hsl(var(--primary))]">PVL</span>
            <span className="hidden sm:block text-[10px] tracking-widest uppercase text-[hsl(var(--muted-foreground))]">
              Peptide Visual Lab
            </span>
          </Link>

          {/* Center links (desktop) */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} to={l.href} className={linkClass}>{l.label}</Link>
            ))}
          </div>

          {/* Right side (desktop) */}
          <div className="hidden md:flex items-center gap-3">
            <button onClick={handleToggle} className={iconBtnClass} aria-label={themeLabel}>
              <ThemeIcon className="h-4 w-4" />
            </button>
            <Link to="/upload" className={cn(ctaClass, "px-5 py-2")}>
              Start Analysis <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Hamburger (mobile) */}
          <button
            onClick={() => setMobileOpen(true)}
            className={cn(iconBtnClass, "md:hidden")}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* Mobile Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-72 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-[hsl(var(--border))]">
            <SheetTitle className="text-left">
              <span className="text-lg font-bold text-[hsl(var(--primary))]">PVL</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col py-4">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} to={l.href} onClick={closeMobile}
                className={cn("px-6 py-3", linkClass, "hover:bg-[hsl(var(--accent))]")}>
                {l.label}
              </Link>
            ))}
            <div className="mx-6 my-3 h-px bg-[hsl(var(--border))]" />
            <button onClick={handleToggle}
              className={cn("flex items-center gap-3 px-6 py-3 w-full text-left", linkClass, "hover:bg-[hsl(var(--accent))]")}>
              <ThemeIcon className="h-4 w-4" />
              {dark ? "Light mode" : "Dark mode"}
            </button>
            <div className="px-6 pt-4">
              <Link to="/upload" onClick={closeMobile} className={cn(ctaClass, "justify-center w-full px-5 py-2.5")}>
                Start Analysis <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
