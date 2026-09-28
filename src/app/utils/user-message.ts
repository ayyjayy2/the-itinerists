/**
 * Turns whatever a Firebase call threw into a sentence a person can act on.
 *
 * The Firebase SDKs throw Errors whose `message` is written for developers
 * ("Initialization of query 'Query(target=…' failed: IndexedDbTransactionError…").
 * Those must never reach the screen. Every Firebase error carries a `code`, so
 * the rule is: an error WITH a code is translated (or replaced by the caller's
 * fallback); an error WITHOUT a code was thrown by this app on purpose and its
 * message is already meant for the user.
 */

const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

const BROKEN_CACHE_MESSAGE =
  "Your browser's saved app data got out of sync. Reload the page and try again.";

const MESSAGES_BY_CODE: Record<string, string> = {
  'unavailable':                 NETWORK_MESSAGE,
  'deadline-exceeded':           NETWORK_MESSAGE,
  'auth/network-request-failed': NETWORK_MESSAGE,
  'permission-denied':           "You don't have permission to do that.",
  'unauthenticated':             'Your session expired. Please sign in again.',
  'resource-exhausted':          'The app is busy right now. Please try again in a minute.',
  'auth/too-many-requests':      'Too many attempts. Please wait a few minutes and try again.',
};

/** Firestore's on-device cache (IndexedDB) failed. Safari on iOS does this
 *  when the database it created earlier has lost an object store; every
 *  query then fails with code=unavailable until the cache is wiped. */
const BROKEN_CACHE_PATTERNS = [
  /IndexedDbTransactionError/i,
  /IndexedDB transaction .* failed/i,
  /object stores was not found/i,
  /IDBDatabase/i,
];

export function isBrokenLocalCacheError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : '';
  return !!message && BROKEN_CACHE_PATTERNS.some(p => p.test(message));
}

export function userMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  if (isBrokenLocalCacheError(err)) return BROKEN_CACHE_MESSAGE;

  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string') return MESSAGES_BY_CODE[code] ?? fallback;

  return err.message || fallback;
}
