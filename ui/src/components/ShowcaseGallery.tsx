/** ShowcaseGallery — Full-width gradient section with overlapping floating screenshots. */
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ShowcaseGalleryProps { className?: string }

function useIsDark() {
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function BrowserFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.3)] bg-[hsl(var(--card))]">
      {/* Chrome bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-black/20 backdrop-blur-sm">
        <span className="h-2 w-2 rounded-full bg-white/20" />
        <span className="h-2 w-2 rounded-full bg-white/20" />
        <span className="h-2 w-2 rounded-full bg-white/20" />
        <div className="ml-2 flex-1 h-4 rounded bg-white/10" />
      </div>
      <img src={src} alt={alt} className="w-full block" loading="lazy" />
    </div>
  );
}

const SHOTS = [
  { file: "data-table.png", alt: "Dataset table view", pos: "left-0 top-8 w-[55%]", rot: "rotate(-2deg)", z: 1 },
  { file: "helical-wheel.png", alt: "Helical wheel analysis", pos: "left-[22%] top-0 w-[55%]", rot: "rotate(0.5deg)", z: 2 },
  { file: "alphafold-viewer.png", alt: "3D structure viewer", pos: "right-0 top-4 w-[55%]", rot: "rotate(1.5deg)", z: 3 },
] as const;

export function ShowcaseGallery({ className }: ShowcaseGalleryProps) {
  const dark = useIsDark();
  const theme = dark ? "dark" : "light";

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(258,80%,55%)] via-[hsl(240,60%,45%)] to-[hsl(180,60%,40%)]" />
      <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_50%,white_0%,transparent_70%)]" />

      <div className="relative z-10 py-20 px-6">
        {/* Desktop: overlapping */}
        <div className="max-w-5xl mx-auto relative hidden md:block" style={{ height: 400 }}>
          {SHOTS.map((s) => (
            <div key={s.file} className={cn("absolute", s.pos)} style={{ transform: s.rot, zIndex: s.z }}>
              <BrowserFrame src={`/screenshots/${theme}/${s.file}`} alt={s.alt} />
            </div>
          ))}
        </div>

        {/* Mobile: stacked */}
        <div className="md:hidden flex flex-col gap-4 max-w-sm mx-auto">
          {SHOTS.map((s) => (
            <BrowserFrame key={s.file} src={`/screenshots/${theme}/${s.file}`} alt={s.alt} />
          ))}
        </div>

        <p className="text-center text-white/80 text-lg mt-12 font-medium">
          Built for researchers at DESY, Technion, and beyond.
        </p>
      </div>
    </div>
  );
}
