/**
 * Global navigation guard — prevents accidental navigation when unsaved work exists.
 * Pages set the guard; AppSidebar checks it before navigating.
 */

let guardActive = false;
let guardCallback: ((destinationPath: string) => void) | null = null;

/** Called by pages to register/unregister a navigation guard */
export function setNavGuard(active: boolean, onAttempt?: (destinationPath: string) => void) {
  guardActive = active;
  guardCallback = onAttempt ?? null;
}

/** Called by AppSidebar to check if navigation should be blocked.
 *  Returns true if blocked (guard is active and callback was invoked). */
export function checkNavGuard(destinationPath?: string): boolean {
  if (guardActive && guardCallback) {
    guardCallback(destinationPath ?? "/");
    return true; // blocked
  }
  return false; // allowed
}
