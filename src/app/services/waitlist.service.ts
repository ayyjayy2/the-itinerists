import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Firestore, addDoc, collection, serverTimestamp } from '@angular/fire/firestore';

/**
 * "Notify me" for the iPhone app: adds an email to the launch list
 * (`_waitlist`, add-only; the owner reads it with scripts/waitlist.js).
 * Works signed out. This device remembers it joined, so the page can say so.
 */
@Injectable({ providedIn: 'root' })
export class WaitlistService {
  private firestore = inject(Firestore);
  private injector  = inject(Injector);
  private readonly KEY = 'waitlist:ios';

  joined(): boolean {
    try { return localStorage.getItem(this.KEY) === '1'; } catch { return false; }
  }

  async join(email: string): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      addDoc(collection(this.firestore, '_waitlist'), { email, list: 'ios', at: serverTimestamp() }));
    try { localStorage.setItem(this.KEY, '1'); } catch { /* private mode */ }
  }
}
