/**
 * Footer — Multi-column footer for PVL landing page.
 *
 * Columns: Product · Resources · Citation · Legal
 * ORCID iDs as small inline badges.
 * Institutional affiliation: Technion + DESY.
 */

import { Github, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FooterProps {
  className?: string;
}

// ── Column data ──────────────────────────────────────────────────────────

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", to: "/#features", internal: true },
      { label: "Demo", to: "/results", internal: true },
      { label: "Self-host", to: "/#self-host", internal: true },
      { label: "Quick Analyze", to: "/quick", internal: true },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help & Docs", to: "/help", internal: true },
      {
        label: "GitHub",
        to: "https://github.com/saidaz24-meet/peptide_prediction",
        internal: false,
      },
      {
        label: "Report Issue",
        to: "https://github.com/saidaz24-meet/peptide_prediction/issues",
        internal: false,
      },
      { label: "About", to: "/about", internal: true },
    ],
  },
  {
    title: "Citation",
    links: [
      // 2026-06-08: DOI flips to a real Zenodo URL the moment v0.3.0 ships.
      // JOSS link flips to the published paper URL once accepted. Both stay
      // disabled placeholders until then.
      { label: "DOI (mints on release)", to: "#", internal: true, disabled: true },
      { label: "BibTeX", to: "#cite", internal: true },
      { label: "JOSS Paper (in submission)", to: "#", internal: true, disabled: true },
    ],
  },
  {
    title: "Legal",
    links: [
      {
        label: "MIT License",
        to: "https://github.com/saidaz24-meet/peptide_prediction/blob/main/LICENSE",
        internal: false,
      },
      { label: "Privacy Policy", to: "/about#privacy", internal: true },
    ],
  },
] as const;

// ── Team with ORCID ──────────────────────────────────────────────────────

const TEAM = [
  {
    name: "Said Azaizah",
    affiliation: "Technion · DESY",
    orcid: null, // to be added
  },
  {
    name: "Dr. Peleg Ragonis-Bachar",
    affiliation: "Technion",
    orcid: null,
  },
  {
    name: "Dr. Aleksandr Golubev",
    affiliation: "DESY",
    orcid: null,
  },
] as const;

// ── Component ────────────────────────────────────────────────────────────

export function Footer({ className }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "relative z-10 border-t border-border/40 bg-card/50 backdrop-blur-sm",
        className
      )}
      data-testid="pvl-footer"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Column grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-12 mb-12">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-foreground mb-4">{col.title}</h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"disabled" in link && link.disabled ? (
                      <span className="text-sm text-muted-foreground/40 cursor-default">
                        {link.label}
                      </span>
                    ) : link.internal ? (
                      <Link
                        to={link.to}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                      >
                        {link.label}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-border/30 pt-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Built by */}
            <div className="text-xs text-muted-foreground/60">
              <span className="font-medium text-muted-foreground">Peptide Visual Lab</span>
              {" · "}
              Built by{" "}
              {TEAM.map((person, i) => (
                <span key={person.name}>
                  {i > 0 && (i === TEAM.length - 1 ? " & " : ", ")}
                  <span className="text-muted-foreground">{person.name}</span>
                  {person.orcid && (
                    <a
                      href={`https://orcid.org/${person.orcid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center ml-0.5"
                      title={`ORCID: ${person.orcid}`}
                    >
                      <img
                        src="https://orcid.org/sites/default/files/images/orcid_16x16.png"
                        alt="ORCID"
                        className="h-3 w-3"
                      />
                    </a>
                  )}
                </span>
              ))}
            </div>

            {/* Right: copyright + GitHub */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground/50">
              <span>&copy; {year} PVL</span>
              <a
                href="https://github.com/saidaz24-meet/peptide_prediction"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-muted-foreground transition-colors"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
