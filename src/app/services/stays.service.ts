import { Injectable, signal, inject, Injector, runInInjectionContext, effect } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, Unsubscribe } from '@angular/fire/firestore';
import { AccommodationDoc } from '../models/trip.models';
import { TripContextService } from './trip-context.service';

@Injectable({ providedIn: 'root' })
export class StaysService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private tripContext = inject(TripContextService);

  private _stays = signal<AccommodationDoc[]>([]);
  readonly stays = this._stays.asReadonly();

  private unsub?: Unsubscribe;

  constructor() {
    effect(() => this.subscribe(this.tripContext.activeTripId()));
  }

  /** Retained for AppComponent compatibility — the constructor effect drives the subscription. */
  init(): void { /* no-op */ }

  private subscribe(tripId: string | null): void {
    this.unsub?.(); this.unsub = undefined;
    if (!tripId) { this._stays.set([]); return; }
    runInInjectionContext(this.injector, () => {
      this.unsub = onSnapshot(collection(this.firestore, 'trips', tripId, 'stays'), snap => {
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
    await setDoc(ref, { ...stay, id: ref.id });
  }

  async updateStay(id: string, updates: Partial<AccommodationDoc>): Promise<void> {
    const tid = this.requireTrip();
    await updateDoc(doc(this.firestore, 'trips', tid, 'stays', id), { ...updates });
  }

  async deleteStay(id: string): Promise<void> {
    const tid = this.requireTrip();
    await deleteDoc(doc(this.firestore, 'trips', tid, 'stays', id));
  }

  private requireTrip(): string {
    const tid = this.tripContext.activeTripId();
    if (!tid) throw new Error('No active trip selected.');
    return tid;
  }
}
