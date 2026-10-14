/**
 * When the app restarts its Firestore connection on coming back on screen (see
 * FirestoreResumeService). A phone pauses an app it has put in the background,
 * live connection included, and Firestore doesn't always notice on return:
 * listeners stay quiet until something else touches the network, so other
 * people's changes don't show (#469).
 */

/** Hidden at least this long counts as paused; a quick switch away and back doesn't. */
export const RECONNECT_AFTER_HIDDEN_MS = 10_000;

/** Whether to restart the connection now the app is back on screen. */
export function shouldReconnect(hiddenAt: number | null, now: number): boolean {
  return hiddenAt !== null && now - hiddenAt >= RECONNECT_AFTER_HIDDEN_MS;
}
