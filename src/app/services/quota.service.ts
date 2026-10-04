import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Firestore, WriteBatch, doc, getDoc, increment, serverTimestamp, writeBatch } from '@angular/fire/firestore';
import { QUOTA_LIMITS, QuotaFullError, QuotaKind, QuotaStep, quotaStep, readCounter } from '../utils/quota';

/**
 * Commits a limited write (a new trip, an outfit photo) in one batch with the
 * account's counter at `_quotas/{uid}/kinds/{kind}`, which the security rules
 * require. Throws QuotaFullError when the day's allowance is used up.
 */
@Injectable({ providedIn: 'root' })
export class QuotaService {
  private firestore = inject(Firestore);
  private injector  = inject(Injector);

  async commitCounted(uid: string, kind: QuotaKind, build: (batch: WriteBatch) => void): Promise<void> {
    await runInInjectionContext(this.injector, async () => {
      const ref = doc(this.firestore, '_quotas', uid, 'kinds', kind);
      const snap = await getDoc(ref);
      const counter = readCounter(snap.exists() ? snap.data() : undefined);
      const step = quotaStep(counter, Date.now(), QUOTA_LIMITS[kind]);
      if (step === 'full') throw new QuotaFullError(kind);

      const commit = (s: Exclude<QuotaStep, 'full'>) => {
        const batch = writeBatch(this.firestore);
        build(batch);
        if (s === 'start') batch.set(ref, { windowStart: serverTimestamp(), count: 1, at: serverTimestamp() });
        else               batch.set(ref, { count: increment(1), at: serverTimestamp() }, { merge: true });
        return batch.commit();
      };
      try {
        await commit(step);
      } catch (err) {
        // The server decides whether the window has passed by its own clock.
        // If this device's clock disagrees, the other step is the right one.
        if (!counter || (err as { code?: string })?.code !== 'permission-denied') throw err;
        try {
          await commit(step === 'start' ? 'add' : 'start');
        } catch (retryErr) {
          if (counter.count >= QUOTA_LIMITS[kind] - 1) throw new QuotaFullError(kind);
          throw retryErr;
        }
      }
    });
  }
}
