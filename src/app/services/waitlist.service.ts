import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Firestore, addDoc, collection, serverTimestamp } from '@angular/fire/firestore';
import { landingSource } from '../utils/waitlist-source';

/**
 * "Notify me" for the iPhone app: adds an email to the launch list
 * (`_waitlist`, add-only; the owner reads it with scripts/waitlist.js).
 * Works signed out. This device remembers it joined, so the page can say so.
 * Each entry says where the person came from: website, or instagram/linkedin
 * when the page was opened from a post link (#763).
 */
@Injectable({ providedIn: 'root' })
export class WaitlistService {
  private firestore = inject(Firestore);
  private injector  = inject(Injector);
  private readonly KEY = 'waitlist:ios';

  joined(): boolean {
    try { return localStorage.getItem(this.KEY) === '1'; } catch { return false; }
  }

  private source() {
    try { return landingSource(sessionStorage); } catch { return 'website' as const; }
  }

  async join(email: string): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      addDoc(collection(this.firestore, '_waitlist'), { email, list: 'ios', source: this.source(), at: serverTimestamp() }));
    try { localStorage.setItem(this.KEY, '1'); } catch { /* private mode */ }
  }
}
