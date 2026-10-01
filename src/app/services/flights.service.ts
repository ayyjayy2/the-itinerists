import { Injectable, signal, inject, Injector, runInInjectionContext, effect, computed } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, Unsubscribe } from '@angular/fire/firestore';
import { FlightDoc } from '../models/trip.models';
import { TripContextService } from './trip-context.service';
import { UserService } from './user.service';
import { TripService } from './trip.service';
import { TripEventsService } from './trip-events.service';
import { flightAdded, flightChanged, flightRemoved } from '../utils/event-text';
import { AirportZoneService } from './airport-zone.service';

@Injectable({ providedIn: 'root' })
export class FlightsService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private tripContext = inject(TripContextService);
  private userService = inject(UserService);
  private tripService = inject(TripService);
  private events      = inject(TripEventsService);
  private airportZones = inject(AirportZoneService);

  /** The active trip id, but only while someone is signed in. Listeners opened
   *  while signed out are refused by the rules and never recover, so trip
   *  subscriptions follow the user as well as the trip. */
  private signedInTripId = computed(() =>
    this.userService.currentUser() ? this.tripContext.activeTripId() : null);

  private _flights = signal<FlightDoc[]>([]);
  readonly flights = this._flights.asReadonly();

  /** False until the first snapshot for the active trip has arrived (pages
   *  hold their empty states until then, see LoadingComponent). */
  private _loaded = signal(false);
  readonly loaded = this._loaded.asReadonly();

  private unsub?: Unsubscribe;

  constructor() {
    effect(() => this.subscribe(this.signedInTripId()));
  }

  /** Retained for AppComponent compatibility — the constructor effect drives the subscription. */
  init(): void { /* no-op */ }

  private subscribe(tripId: string | null): void {
    this.unsub?.(); this.unsub = undefined;
    if (!tripId) { this._flights.set([]); this._loaded.set(true); return; }
    this._loaded.set(false);
    runInInjectionContext(this.injector, () => {
      this.unsub = onSnapshot(collection(this.firestore, 'trips', tripId, 'flights'), snap => {
        this._loaded.set(true);
        this._flights.set(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as FlightDoc))
            .sort((a, b) =>
              a.departureDate.localeCompare(b.departureDate) ||
              a.departureTime.localeCompare(b.departureTime)
            )
        );
      });
    });
  }

  async addFlight(data: Omit<FlightDoc, 'id'>): Promise<void> {
    const tid = this.requireTrip();
    const ref = doc(collection(this.firestore, 'trips', tid, 'flights'));
    const full = { ...data, id: ref.id } as FlightDoc;
    await setDoc(ref, full);
    const t = flightAdded(full, this.ownerName(full.uid), this.me(), this.airportZones.zoneFor(full.from));
    this.events.emit({ kind: 'flight', action: 'added', itemId: ref.id, path: '/flights', ...t });
  }

  async updateFlight(id: string, data: Partial<Omit<FlightDoc, 'id'>>): Promise<void> {
    const tid = this.requireTrip();
    const before = this._flights().find(f => f.id === id);
    await updateDoc(doc(this.firestore, 'trips', tid, 'flights', id), { ...data });
    if (!before) return;
    const after = { ...before, ...data } as FlightDoc;
    const t = flightChanged(before, after, this.ownerName(after.uid), this.me());
    if (t) this.events.emit({ kind: 'flight', action: 'changed', itemId: id, path: '/flights', ...t });
  }

  async deleteFlight(id: string): Promise<void> {
    const tid = this.requireTrip();
    const before = this._flights().find(f => f.id === id);
    await deleteDoc(doc(this.firestore, 'trips', tid, 'flights', id));
    if (!before) return;
    const t = flightRemoved(before, this.ownerName(before.uid), this.me());
    this.events.emit({ kind: 'flight', action: 'removed', itemId: id, path: '/flights', ...t });
  }

  private me(): string { return this.userService.currentUser()?.uid ?? ''; }
  private ownerName(uid: string): string {
    return this.tripService.activeMembers().find(m => m.uid === uid)?.displayName ?? 'a';
  }

  private requireTrip(): string {
    const tid = this.tripContext.activeTripId();
    if (!tid) throw new Error('No active trip selected.');
    return tid;
  }
}
