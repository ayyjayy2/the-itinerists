/**
 * When the web app looks for a new version of itself (see AppUpdateService).
 * There's no service worker: an open app keeps the version it loaded, and a
 * home-screen app is usually resumed rather than relaunched, so people could
 * stay on an old version for days after a deploy.
 */

/** Look again at most this often, so switching between apps doesn't fetch every time. */
export const UPDATE_CHECK_MIN_GAP_MS = 60_000;

/** Whether to look for a new version now the app is back on screen. */
export function shouldCheckForUpdate(lastCheckAt: number | null, now: number): boolean {
  return lastCheckAt === null || now - lastCheckAt >= UPDATE_CHECK_MIN_GAP_MS;
}

const NOT_TYPED_IN = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'image', 'range', 'color']);

/** Whether someone is in the middle of typing or choosing, so a refresh would lose it. */
export function isTyping(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') return !NOT_TYPED_IN.has(((el as HTMLInputElement).type || 'text').toLowerCase());
  return (el as HTMLElement).isContentEditable || el.getAttribute('contenteditable') === 'true';
}

/** Whether the live build (from /version.json) is newer than the one running. */
export function isNewerBuild(live: string | undefined, running: string): boolean {
  if (!live || !/^\d+$/.test(live) || !/^\d+$/.test(running)) return false;
  return Number(live) > Number(running);
}
