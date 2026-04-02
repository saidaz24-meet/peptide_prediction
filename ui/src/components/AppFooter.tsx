import { FeedbackDialog } from "./FeedbackDialog";
import { FlaskConical, Github } from "lucide-react";

export default function AppFooter() {
  return (
    <footer className="mt-10 border-t border-[hsl(var(--border))] pt-6 pb-8">
      <div className="flex flex-col items-center gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <FlaskConical className="h-3.5 w-3.5 text-primary/60" />
          <span className="text-xs font-medium">Peptide Visual Lab</span>
        </div>

        {/* Credits */}
        <div className="text-center text-[11px] text-muted-foreground leading-relaxed space-y-0.5">
          <p>
            Built by <span className="font-medium text-foreground/80">Said Azaizah</span>
            {" · "}Algorithms by <span className="font-medium text-foreground/80">Dr. Peleg Ragonis-Bachar</span>
          </p>
          <p>
            Scientific advisor: <span className="font-medium text-foreground/80">Dr. Aleksandr Golubev</span>
            {" · "}Technion & DESY
          </p>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-3">
          <FeedbackDialog />
          <span className="text-[hsl(var(--border))]">|</span>
          <a
            href="https://github.com/saidazaizah/peptide-visual-lab"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
        </div>

        {/* Copyright */}
        <p className="text-[10px] text-[hsl(var(--faint))]">
          &copy; {new Date().getFullYear()} Peptide Visual Lab &middot; MIT License
        </p>
      </div>
    </footer>
  );
}
