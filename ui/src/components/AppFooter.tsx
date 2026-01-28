import { FeedbackDialog } from './FeedbackDialog';

export default function AppFooter() {
  return (
    <footer className="mt-10 py-6 text-center text-xs text-muted-foreground">
      <div className="flex items-center justify-center gap-4 mb-2">
        <FeedbackDialog />
      </div>
      © {new Date().getFullYear()} Peptide Visual Lab · Frontend: <b>Said Azaizah</b> ·
      Backend & algorithms provided by <b>Dr. Aleksandr Golubev</b> ·{" "}
    </footer>
  );
}
  