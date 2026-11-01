import { Injectable, Injector, computed, effect, inject, runInInjectionContext } from '@angular/core';
import { Firestore, deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, Unsubscribe } from '@angular/fire/firestore';
import { TripService } from './trip.service';
import { UserService } from './user.service';
import { ItineraryService } from './itinerary.service';
import { FlightsService } from './flights.service';
import { StaysService } from './stays.service';
import { AirportZoneService } from './airport-zone.service';
import { ShareView, buildShareView, newShareToken } from '../utils/share-view';
import { DEMO } from '../demo-flag';
import { publicLink } from '../shared/public-link';

/**
 * The read-only page a trip's members can share with people at home (#611),
 * at /view#<token>.
 * The trip names its live link (`shareToken`); `shares/<token>` holds the
 * display copy anyone with the link can read. While the trip is shared, any
 * member who can edit keeps that copy current: when the plan they see differs
 * from what's published, their app publishes it again (a moment later, so a
 * burst of edits makes one write). Turning sharing off deletes it.
 */
@Injectable({ providedIn: 'root' })
export class ShareViewService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private tripService = inject(TripService);
  private userService = inject(UserService);
  private itinerary = inject(ItineraryService);
  private flights = inject(FlightsService);
  private stays = inject(StaysService);
  private airportZones = inject(AirportZoneService);

  /** The active trip's share link, or '' when it isn't shared. */
  readonly token = computed(() => this.tripService.activeTrip()?.shareToken ?? '');
  /** The full address to send people. */
  readonly url = computed(() => (this.token() ? publicLink(`/view#${this.token()}`) : ''));

  /** What the page should show now, from the plan this device has. */
  private view = computed<ShareView | null>(() => {
    const trip = this.tripService.activeTrip();
    if (!trip?.shareToken) return null;
    const zones = this.airportZones.zones();
    return buildShareView({
      trip, members: this.tripService.activeMembers(),
      itinerary: this.itinerary.items(), flights: this.flights.flights(), stays: this.stays.stays(),
      airportZone: code => zones[code?.toUpperCase()] ?? this.airportZones.zoneFor(code),
    });
  });

  private published = '';           // the copy last seen on the server, as JSON
  private watching = '';            // the token whose published copy we follow
  private unsub?: Unsubscribe;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private started = false;

  /** Called once from the root component. */
  start(): void {
    if (this.started) return;
    this.started = true;
    runInInjectionContext(this.injector, () => effect(() => {
      const token = this.token(), view = this.view();
      if (token !== this.watching) this.follow(token);
      if (!token || !view || this.userService.isGuest() || !this.userService.currentUser()) return;
      const next = JSON.stringify(view);
      clearTimeout(this.timer);
      // The demo has no other devices: publish at once so the page opens straight away.
      const publishIfChanged = () => { if (next !== this.published) void this.publish(token, view, next); };
      if (DEMO) publishIfChanged(); else this.timer = setTimeout(publishIfChanged, 3000);
    }));
  }

  /** Follow what's published for `token` (one read, then changes only), so unchanged plans write nothing. */
  private follow(token: string): void {
    this.unsub?.(); this.unsub = undefined;
    this.watching = token;
    this.published = '';
    if (!token) return;
    runInInjectionContext(this.injector, () => {
      this.unsub = onSnapshot(doc(this.firestore, 'shares', token), snap => {
        this.published = snap.exists() ? JSON.stringify(snap.data()['view']) : '';
      }, () => { /* not readable yet; the next publish creates it */ });
    });
  }

  private async publish(token: string, view: ShareView, json: string): Promise<void> {
    const tripId = this.tripService.activeTrip()?.id;
    if (!tripId) return;
    await runInInjectionContext(this.injector, () =>
      setDoc(doc(this.firestore, 'shares', token), { tripId, view, updatedAt: serverTimestamp() }))
      .then(() => { this.published = json; })
      .catch(err => console.warn('[ShareView] publish failed:', (err as Error).message));
  }

  /** Share the trip: a new link (any old one stops working). Returns the address. */
  async share(): Promise<string> {
    const trip = this.tripService.activeTrip();
    if (!trip) throw new Error('Open a trip first.');
    const old = trip.shareToken;
    const token = newShareToken();
    await runInInjectionContext(this.injector, async () => {
      if (old) await deleteDoc(doc(this.firestore, 'shares', old)).catch(() => {/* already gone */});
      await updateDoc(doc(this.firestore, 'trips', trip.id), { shareToken: token });
    });
    const view = this.view() ?? buildShareView({
      trip: { ...trip, shareToken: token }, members: this.tripService.activeMembers(),
      itinerary: this.itinerary.items(), flights: this.flights.flights(), stays: this.stays.stays(),
      airportZone: code => this.airportZones.zoneFor(code),
    });
    await this.publish(token, view, JSON.stringify(view));
    return publicLink(`/view#${token}`);
  }

  /** Stop sharing: the link stops working at once. */
  async stop(): Promise<void> {
    const trip = this.tripService.activeTrip();
    if (!trip?.shareToken) return;
    await runInInjectionContext(this.injector, async () => {
      await deleteDoc(doc(this.firestore, 'shares', trip.shareToken!));
      await updateDoc(doc(this.firestore, 'trips', trip.id), { shareToken: deleteField() });
    });
  }

  /** The page itself (/view#<token>), for people at home: the published copy, live. */
  watch(token: string, next: (view: ShareView | null) => void): Unsubscribe {
    return runInInjectionContext(this.injector, () =>
      onSnapshot(doc(this.firestore, 'shares', token),
        snap => next(snap.exists() ? (snap.data()['view'] as ShareView) : null),
        () => next(null)));
  }
}
