/**
 * Auto-recover from "Failed to fetch dynamically imported module" errors.
 *
 * Cause: Vite emits content-hashed chunk filenames. After a deploy, the
 * hashes change. A user with a tab open (or a stale cached index.html)
 * tries to load OLD chunk filenames that no longer exist on the server,
 * gets 404, and the dynamic import throws. The Sentry error boundary
 * then renders "Something went wrong" — a dead-end for the user.
 *
 * Root fix: when we detect a chunk-load failure, reload the page ONCE.
 * The reload fetches the new index.html (which nginx serves Cache-
 * Control: no-store, see docker/nginx.conf), which references the new
 * chunk hashes, and the next dynamic import succeeds.
 *
 * Guard against infinite reload loops: a sessionStorage flag prevents
 * more than one reload per browser session. If the reload didn't fix
 * the issue (rare — e.g. CDN cache lag, server actually broken), the
 * second time the user falls through to the regular error boundary
 * and sees the message + Try Again button. Sentry still captures the
 * error.
 *
 * Reference: https://vite.dev/guide/build.html#load-error-handling
 */

const RELOAD_FLAG = "pvl-chunk-error-reloaded";
const RELOAD_FLAG_TTL_MS = 30_000; // 30s after a reload, don't re-reload

/** Best-effort: is this error a chunk-load failure? */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Loading chunk \d+ failed/i.test(message) ||
    /Loading CSS chunk \d+ failed/i.test(message) ||
    /ChunkLoadError/i.test(name)
  );
}

/** Reload the page once. Skips if we already reloaded in this session. */
export function reloadForChunkError(): boolean {
  try {
    const prev = sessionStorage.getItem(RELOAD_FLAG);
    if (prev) {
      const elapsed = Date.now() - Number(prev);
      if (elapsed < RELOAD_FLAG_TTL_MS) {
        // Already reloaded recently — fall through to error UI.
        return false;
      }
    }
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
    // location.reload() — fetch fresh index.html (cached: no-store) and
    // therefore fresh chunk references.
    window.location.reload();
    return true;
  } catch {
    // sessionStorage unavailable (private mode in some browsers) — just
    // reload and hope for the best.
    window.location.reload();
    return true;
  }
}

/**
 * Install global listeners for chunk load failures. Call once at app boot
 * (from main.tsx). Idempotent — calling twice is harmless.
 */
let installed = false;
export function installChunkErrorRecovery(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Vite fires this event when a <link rel=modulepreload> fails. It's the
  // first signal we get when an asset hash has rotated under us.
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForChunkError()) {
      // Stop other listeners + the default error from propagating.
      event.preventDefault();
    }
  });

  // Generic unhandled rejection: import() that rejects falls here.
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) {
      if (reloadForChunkError()) event.preventDefault();
    }
  });

  // Sync errors during dynamic import in the React render path show up
  // here as well.
  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.error ?? event.message)) {
      if (reloadForChunkError()) event.preventDefault();
    }
  });
}
