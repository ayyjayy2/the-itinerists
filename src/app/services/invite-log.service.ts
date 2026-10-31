import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, serverTimestamp } from '@angular/fire/firestore';
import { Capacitor } from '@capacitor/core';
import { usagePlatform } from '../utils/usage';
import { firstOpen, visitorId, InviteVia } from '../utils/invite-opens';
import { DEMO } from '../demo-flag';

/**
 * Records that a device reached a live invite (`_inviteOpens`, #609), by its
 * link or by typing its code, signed in or not: the "people invited" of the
 * invite-to-join rate in Pulse. Counts only: the trip, how it was reached, a
 * random id for the device and the platform; never the code or who it is.
 */
@Injectable({ providedIn: 'root' })
export class InviteLogService {
  private firestore = inject(Firestore);

  opened(tripId: string, via: InviteVia): void {
    if (DEMO) return;
    const store = typeof localStorage === 'undefined' ? null : localStorage;
    if (!firstOpen(store, tripId)) return;
    const platform = usagePlatform(
      Capacitor.isNativePlatform(),
      typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches,
    );
    addDoc(collection(this.firestore, '_inviteOpens'), {
      tripId, via, platform, visitor: visitorId(store, () => crypto.randomUUID()), at: serverTimestamp(),
    }).catch(() => { /* analytics never blocks joining */ });
  }
}
