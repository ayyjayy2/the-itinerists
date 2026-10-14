import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Firestore, disableNetwork, enableNetwork } from '@angular/fire/firestore';
import { shouldReconnect } from '../utils/firestore-resume';

/**
 * Brings live updates back after the app has been in the background (#469).
 * When the app comes back on screen after being hidden a while, it turns the
 * Firestore connection off and on again: every listener then catches up from
 * where it left off, and writes made meanwhile stay queued and are sent.
 * Runs in the browser, the home-screen app and the iPhone app alike.
 */
@Injectable({ providedIn: 'root' })
export class FirestoreResumeService {
  private firestore = inject(Firestore);
  private injector  = inject(Injector);
  private started = false;
  private hiddenAt: number | null = null;
  /** The latest restart, so tests can wait for it. */
  settled: Promise<void> = Promise.resolve();

  private readonly onVisibility = () => {
    const now = Date.now();
    if (document.visibilityState === 'hidden') { this.hiddenAt ??= now; return; }
    if (document.visibilityState !== 'visible') return;
    const reconnect = shouldReconnect(this.hiddenAt, now);
    this.hiddenAt = null;
    if (reconnect) this.settled = this.reconnect();
  };

  start(): void {
    if (this.started) return;
    this.started = true;
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  stop(): void {
    this.started = false;
    this.hiddenAt = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private async reconnect(): Promise<void> {
    try { await this.goOffline(); }
    catch (err) { console.warn('[FirestoreResume] pausing the connection failed:', (err as Error).message); }
    try { await this.goOnline(); }
    catch (err) { console.warn('[FirestoreResume] restarting the connection failed:', (err as Error).message); }
  }

  private goOffline(): Promise<void> {
    return runInInjectionContext(this.injector, () => disableNetwork(this.firestore));
  }

  private goOnline(): Promise<void> {
    return runInInjectionContext(this.injector, () => enableNetwork(this.firestore));
  }
}
