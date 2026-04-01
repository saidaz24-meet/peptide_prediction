/**
 * Global navigation guard — prevents accidental navigation when unsaved work exists.
 * Pages set the guard; AppSidebar checks it before navigating.
 */

let guardActive = false;
let guardCallback: (() => void) | null = null;

/** Called by pages to register/unregister a navigation guard */
export function setNavGuard(active: boolean, onAttempt?: () => void) {
  guardActive = active;
  guardCallback = onAttempt ?? null;
}

/** Called by AppSidebar to check if navigation should be blocked */
export function checkNavGuard(): boolean {
  if (guardActive && guardCallback) {
    guardCallback();
    return true; // blocked
  }
  return false; // allowed
}
