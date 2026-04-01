/** TrustSection — Gradient quote card + institution row + tagline. */
import { Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrustSectionProps { className?: string }

const INSTITUTIONS = [
  { name: "DESY", location: "Hamburg, Germany" },
  { name: "Technion", location: "Haifa, Israel" },
  { name: "EMBL", location: "Heidelberg, Germany" },
  { name: "Open Source", location: "MIT Licensed", isOSS: true },
] as const;

export function TrustSection({ className }: TrustSectionProps) {
  return (
    <div className={className}>
      {/* Heading */}
      <div className="max-w-2xl mb-10">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[hsl(var(--foreground))] mb-3">
          Built for Researchers
        </h2>
        <p className="text-lg text-[hsl(var(--muted-foreground))] leading-relaxed">
          Trusted by labs across the world.
        </p>
      </div>

      {/* Quote card */}
      <div className="max-w-4xl mx-auto relative rounded-2xl overflow-hidden p-8 sm:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(258,90%,66%)] via-[hsl(240,70%,50%)] to-[hsl(220,80%,45%)]" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_20%,white_0%,transparent_50%)]" />

        <div className="relative z-10">
          {/* Quote icon */}
          <svg className="h-8 w-8 text-white/30 mb-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C9.591 11.69 11 13.166 11 15c0 1.933-1.567 3.5-3.5 3.5-1.171 0-2.277-.566-2.917-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C19.591 11.69 21 13.166 21 15c0 1.933-1.567 3.5-3.5 3.5-1.171 0-2.277-.566-2.917-1.179z" />
          </svg>

          <blockquote className="text-xl sm:text-2xl font-medium text-white leading-relaxed mb-8">
            "PVL replaced three separate tools in our peptide aggregation workflow.
            One upload, complete structural profile — secondary structure, aggregation
            propensity, and fibril-forming helix detection in a single view."
          </blockquote>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm">
              PB
            </div>
            <div>
              <p className="text-white font-medium text-sm">Peptide Biophysics Lab</p>
              <p className="text-white/60 text-sm">Technion &amp; DESY Collaboration</p>
            </div>
          </div>
        </div>
      </div>

      {/* Institution row */}
      <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 mt-12 max-w-3xl mx-auto">
        {INSTITUTIONS.map((inst) => (
          <div key={inst.name} className="flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
            {inst.isOSS ? (
              <span className="flex items-center gap-1.5 text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
                <Code2 className="h-4 w-4" />
                {inst.name}
              </span>
            ) : (
              <span className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
                {inst.name}
              </span>
            )}
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{inst.location}</span>
          </div>
        ))}
      </div>

      {/* Tagline */}
      <p className="text-center text-sm text-[hsl(var(--faint))] mt-8">
        Publication-ready output · Deterministic results · Fully reproducible
      </p>
    </div>
  );
}
