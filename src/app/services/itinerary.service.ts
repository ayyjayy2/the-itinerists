import { Injectable, signal, inject, Injector, runInInjectionContext, effect } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, Unsubscribe } from '@angular/fire/firestore';
import { ItineraryItemDoc } from '../models/trip.models';
import { TripContextService } from './trip-context.service';

@Injectable({ providedIn: 'root' })
export class ItineraryService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private tripContext = inject(TripContextService);

  private _items     = signal<ItineraryItemDoc[]>([]);
  private _dayLabels = signal<Record<string, string>>({});

  readonly items     = this._items.asReadonly();
  readonly dayLabels = this._dayLabels.asReadonly();

  private unsub?: Unsubscribe;
  private labelUnsub?: Unsubscribe;
  private labelUid?: string;

  constructor() {
    effect(() => {
      const tripId = this.tripContext.activeTripId();
      this.subscribe(tripId);
      if (this.labelUid) this.loadDayLabels(this.labelUid); // re-bind day labels to the new trip
    });
  }

  /** Retained for AppComponent compatibility — the constructor effect drives the subscription. */
  init(): void { /* no-op */ }

  private subscribe(tripId: string | null): void {
    this.unsub?.(); this.unsub = undefined;
    if (!tripId) { this._items.set([]); return; }
    runInInjectionContext(this.injector, () => {
      this.unsub = onSnapshot(collection(this.firestore, 'trips', tripId, 'itinerary'), snap => {
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
    await setDoc(ref, { ...item, id: ref.id });
  }

  async updateItem(id: string, updates: Partial<ItineraryItemDoc>): Promise<void> {
    const tid = this.requireTrip();
    await updateDoc(doc(this.firestore, 'trips', tid, 'itinerary', id), { ...updates });
  }

  async deleteItem(id: string): Promise<void> {
    const tid = this.requireTrip();
    await deleteDoc(doc(this.firestore, 'trips', tid, 'itinerary', id));
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
