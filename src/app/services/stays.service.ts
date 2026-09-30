import { Injectable, signal, inject, Injector, runInInjectionContext, effect, computed } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, Unsubscribe } from '@angular/fire/firestore';
import { AccommodationDoc } from '../models/trip.models';
import { TripContextService } from './trip-context.service';
import { UserService } from './user.service';
import { TripService } from './trip.service';
import { TripEventsService } from './trip-events.service';
import { stayAdded, stayChanged, stayRemoved } from '../utils/event-text';

@Injectable({ providedIn: 'root' })
export class StaysService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private tripContext = inject(TripContextService);
  private userService = inject(UserService);
  private tripService = inject(TripService);
  private events      = inject(TripEventsService);

  /** The active trip id, but only while someone is signed in. Listeners opened
   *  while signed out are refused by the rules and never recover, so trip
   *  subscriptions follow the user as well as the trip. */
  private signedInTripId = computed(() =>
    this.userService.currentUser() ? this.tripContext.activeTripId() : null);

  private _stays = signal<AccommodationDoc[]>([]);
  readonly stays = this._stays.asReadonly();

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
    if (!tripId) { this._stays.set([]); this._loaded.set(true); return; }
    this._loaded.set(false);
    runInInjectionContext(this.injector, () => {
      this.unsub = onSnapshot(collection(this.firestore, 'trips', tripId, 'stays'), snap => {
        this._loaded.set(true);
        this._stays.set(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as AccommodationDoc))
            .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
        );
      });
    });
  }

  async addStay(stay: Omit<AccommodationDoc, 'id'>): Promise<void> {
    const tid = this.requireTrip();
    const ref = doc(collection(this.firestore, 'trips', tid, 'stays'));
    const full = { ...stay, id: ref.id } as AccommodationDoc;
    await setDoc(ref, full);
    const t = stayAdded(full, this.tripService.activeMembers());
    this.events.emit({ kind: 'stay', action: 'added', itemId: ref.id, path: '/accommodations', ...t });
  }

  async updateStay(id: string, updates: Partial<AccommodationDoc>): Promise<void> {
    const tid = this.requireTrip();
    const before = this._stays().find(s => s.id === id);
    await updateDoc(doc(this.firestore, 'trips', tid, 'stays', id), { ...updates });
    if (!before) return;
    const t = stayChanged(before, { ...before, ...updates }, this.tripService.activeMembers());
    if (t) this.events.emit({ kind: 'stay', action: 'changed', itemId: id, path: '/accommodations', ...t });
  }

  async deleteStay(id: string): Promise<void> {
    const tid = this.requireTrip();
    const before = this._stays().find(s => s.id === id);
    await deleteDoc(doc(this.firestore, 'trips', tid, 'stays', id));
    if (!before) return;
    const t = stayRemoved(before, this.tripService.activeMembers());
    this.events.emit({ kind: 'stay', action: 'removed', itemId: id, path: '/accommodations', ...t });
  }

  private requireTrip(): string {
    const tid = this.tripContext.activeTripId();
    if (!tid) throw new Error('No active trip selected.');
    return tid;
  }
}
