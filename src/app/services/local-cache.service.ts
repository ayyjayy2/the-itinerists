import { Injectable, inject } from '@angular/core';
import { Firestore, terminate, clearIndexedDbPersistence } from '@angular/fire/firestore';
import { isBrokenLocalCacheError } from '../utils/user-message';

/**
 * Recovers from a corrupted Firestore on-device cache.
 *
 * Firestore keeps an IndexedDB copy of everything it has read (app.config.ts).
 * Safari on iOS sometimes hands back that database with an object store
 * missing — seen most in the in-app browser that opens from Messages — and
 * from then on every query in the session fails with "IndexedDB transaction
 * … failed: One of the specified object stores was not found". Nothing the
 * user does on the page fixes it. The cure is to shut Firestore down, delete
 * its database, and load the app again; the cache is rebuilt from the server.
 */
@Injectable({ providedIn: 'root' })
export class LocalCacheService {
  private firestore = inject(Firestore);

  /** If `err` is the broken-cache failure, wipe the cache and reload. Returns
   *  true when a reload has been started (the caller can stop what it's doing). */
  recoverIfBroken(err: unknown): boolean {
    if (!isBrokenLocalCacheError(err)) return false;

    // One attempt per minute per tab: if a fresh cache still fails, the error
    // shows on screen instead of the page reloading forever.
    const key = 'localCacheResetAt';
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(key, String(Date.now()));

    void this.reset();
    return true;
  }

  private async reset(): Promise<void> {
    try {
      await terminate(this.firestore);
      await clearIndexedDbPersistence(this.firestore);
    } catch (e) {
      console.warn('[LocalCache] could not clear the cache before reloading', e);
    } finally {
      window.location.reload();
    }
  }
}
