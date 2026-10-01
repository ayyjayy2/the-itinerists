import { Injectable, signal, inject, Injector, runInInjectionContext, effect, computed } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, Unsubscribe } from '@angular/fire/firestore';
import { ItineraryItemDoc } from '../models/trip.models';
import { TripContextService } from './trip-context.service';
import { UserService } from './user.service';
import { TripService } from './trip.service';
import { TripEventsService } from './trip-events.service';
import { itineraryAdded, itineraryChanged, itineraryRemoved } from '../utils/event-text';
import { tripZone } from '../utils/trip-destinations';

@Injectable({ providedIn: 'root' })
export class ItineraryService {
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

  private _items     = signal<ItineraryItemDoc[]>([]);
  private _dayLabels = signal<Record<string, string>>({});

  readonly items     = this._items.asReadonly();
  readonly dayLabels = this._dayLabels.asReadonly();

  /** False until the first snapshot for the active trip has arrived (pages
   *  hold their empty states until then, see LoadingComponent). */
  private _loaded = signal(false);
  readonly loaded = this._loaded.asReadonly();

  private unsub?: Unsubscribe;
  private labelUnsub?: Unsubscribe;
  private labelUid?: string;

  constructor() {
    effect(() => {
      const tripId = this.signedInTripId();
      this.subscribe(tripId);
      if (this.labelUid) this.loadDayLabels(this.labelUid); // re-bind day labels to the new trip
    });
  }

  /** Retained for AppComponent compatibility — the constructor effect drives the subscription. */
  init(): void { /* no-op */ }

  private subscribe(tripId: string | null): void {
    this.unsub?.(); this.unsub = undefined;
    if (!tripId) { this._items.set([]); this._loaded.set(true); return; }
    this._loaded.set(false);
    runInInjectionContext(this.injector, () => {
      this.unsub = onSnapshot(collection(this.firestore, 'trips', tripId, 'itinerary'), snap => {
        this._loaded.set(true);
        this._items.set(snap.docs.map(d => ({ id: d.id, ...d.data() } as ItineraryItemDoc)));
      });
    });
  }

  loadDayLabels(uid: string): void {
    this.labelUid = uid;
    this.labelUnsub?.(); this.labelUnsub = undefined;
    const tid = this.tripContext.activeTripId();
    if (!tid) { this._dayLabels.set({}); return; }
    runInInjectionContext(this.injector, () => {
      this.labelUnsub = onSnapshot(doc(this.firestore, 'trips', tid, 'dayLabels', uid), snap => {
        this._dayLabels.set(snap.exists() ? (snap.data()['dayLabels'] ?? {}) : {});
      });
    });
  }

  async saveDayLabel(uid: string, date: string, label: string): Promise<void> {
    const tid = this.requireTrip();
    await setDoc(doc(this.firestore, 'trips', tid, 'dayLabels', uid),
      { dayLabels: { [date]: label } }, { merge: true });
  }

  async addItem(item: Omit<ItineraryItemDoc, 'id'>): Promise<void> {
    const tid = this.requireTrip();
    const ref = doc(collection(this.firestore, 'trips', tid, 'itinerary'));
    const full = { ...item, id: ref.id } as ItineraryItemDoc;
    await setDoc(ref, full);
    const t = itineraryAdded(full, this.dayNumber(full.date), this.tripService.activeMembers(), tripZone(this.tripService.activeTrip()));
    this.events.emit({ kind: 'itinerary', action: 'added', itemId: ref.id, path: '/itinerary', ...t });
  }

  async updateItem(id: string, updates: Partial<ItineraryItemDoc>): Promise<void> {
    const tid = this.requireTrip();
    const before = this._items().find(i => i.id === id);
    await updateDoc(doc(this.firestore, 'trips', tid, 'itinerary', id), { ...updates });
    if (!before) return;
    const t = itineraryChanged(before, { ...before, ...updates }, this.tripService.activeMembers(), tripZone(this.tripService.activeTrip()));
    if (t) this.events.emit({ kind: 'itinerary', action: 'changed', itemId: id, path: '/itinerary', ...t });
  }

  async deleteItem(id: string): Promise<void> {
    const tid = this.requireTrip();
    const before = this._items().find(i => i.id === id);
    await deleteDoc(doc(this.firestore, 'trips', tid, 'itinerary', id));
    if (!before) return;
    const t = itineraryRemoved(before, this.dayNumber(before.date), this.tripService.activeMembers());
    this.events.emit({ kind: 'itinerary', action: 'removed', itemId: id, path: '/itinerary', ...t });
  }

  /** 1-based day number within the trip, or null when the trip has no start date. */
  private dayNumber(dateISO: string): number | null {
    const start = this.tripService.activeTrip()?.startDate;
    if (!start || !dateISO) return null;
    const ms = new Date(dateISO + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime();
    const n = Math.round(ms / 86_400_000) + 1;
    return n >= 1 ? n : null;
  }

  /** Updates sortOrder for all items in a day after a drag-drop. */
  async reorderDay(items: ItineraryItemDoc[]): Promise<void> {
    const tid = this.requireTrip();
    await Promise.all(
      items.map((item, i) => updateDoc(doc(this.firestore, 'trips', tid, 'itinerary', item.id), { sortOrder: i }))
    );
  }

  private requireTrip(): string {
    const tid = this.tripContext.activeTripId();
    if (!tid) throw new Error('No active trip selected.');
    return tid;
  }
}
