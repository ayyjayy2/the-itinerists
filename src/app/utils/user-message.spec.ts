import { isBrokenLocalCacheError, userMessage } from './user-message';

/** Shape of an error thrown by the Firebase SDKs: a plain Error with a `code`. */
function firebaseError(code: string, message = 'FirebaseError: something technical'): Error {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

const SAFARI_CACHE_ERROR =
  "Initialization of query 'Query(target=Target(inviteIndex/68WBSKLR, orderBy: [__name__ (asc)]); limitType=F)' failed: " +
  "IndexedDbTransactionError: [code=unavailable]: IndexedDB transaction 'Allocate target' failed: " +
  "NotFoundError: Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found.";

describe('isBrokenLocalCacheError', () => {
  it('recognises the Safari missing-object-store failure', () => {
    expect(isBrokenLocalCacheError(firebaseError('unavailable', SAFARI_CACHE_ERROR))).toBeTrue();
  });

  it('recognises other IndexedDB transaction failures', () => {
    expect(isBrokenLocalCacheError(new Error("IndexedDbTransactionError: [code=unavailable]: IndexedDB transaction 'x' failed"))).toBeTrue();
  });

  it('ignores ordinary network unavailability', () => {
    expect(isBrokenLocalCacheError(firebaseError('unavailable', 'Failed to get document because the client is offline.'))).toBeFalse();
  });

  it('ignores non-errors', () => {
    expect(isBrokenLocalCacheError(undefined)).toBeFalse();
    expect(isBrokenLocalCacheError('IndexedDB')).toBeFalse();
  });
});

describe('userMessage', () => {
  const fallback = 'Something went wrong. Please try again.';

  it('never shows the raw cache failure; explains it in plain words', () => {
    const msg = userMessage(firebaseError('unavailable', SAFARI_CACHE_ERROR), fallback);
    expect(msg).toBe("Your browser's saved app data got out of sync. Reload the page and try again.");
  });

  it('keeps messages the app wrote itself (plain Errors without a code)', () => {
    expect(userMessage(new Error('This invite code is invalid or has already been used.'), fallback))
      .toBe('This invite code is invalid or has already been used.');
  });

  it('translates common Firestore codes', () => {
    expect(userMessage(firebaseError('unavailable'), fallback)).toBe("Couldn't reach the server. Check your connection and try again.");
    expect(userMessage(firebaseError('deadline-exceeded'), fallback)).toBe("Couldn't reach the server. Check your connection and try again.");
    expect(userMessage(firebaseError('permission-denied'), fallback)).toBe("You don't have permission to do that.");
    expect(userMessage(firebaseError('unauthenticated'), fallback)).toBe('Your session expired. Please sign in again.');
    expect(userMessage(firebaseError('resource-exhausted'), fallback)).toBe('The app is busy right now. Please try again in a minute.');
  });

  it('translates common Auth codes', () => {
    expect(userMessage(firebaseError('auth/network-request-failed'), fallback)).toBe("Couldn't reach the server. Check your connection and try again.");
    expect(userMessage(firebaseError('auth/too-many-requests'), fallback)).toBe('Too many attempts. Please wait a few minutes and try again.');
  });

  it('falls back for Firebase codes it does not know, hiding the technical text', () => {
    expect(userMessage(firebaseError('internal', 'INTERNAL ASSERTION FAILED: Unexpected state'), fallback)).toBe(fallback);
  });

  it('falls back for empty or non-Error values', () => {
    expect(userMessage(undefined, fallback)).toBe(fallback);
    expect(userMessage(new Error(''), fallback)).toBe(fallback);
    expect(userMessage('boom', fallback)).toBe(fallback);
  });
});
