import { Injectable, signal, inject, Injector, runInInjectionContext, effect } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, Unsubscribe } from '@angular/fire/firestore';
import { FlightDoc } from '../models/trip.models';
import { TripContextService } from './trip-context.service';

@Injectable({ providedIn: 'root' })
export class FlightsService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private tripContext = inject(TripContextService);

  private _flights = signal<FlightDoc[]>([]);
  readonly flights = this._flights.asReadonly();

  private unsub?: Unsubscribe;

  constructor() {
    effect(() => this.subscribe(this.tripContext.activeTripId()));
  }

  /** Retained for AppComponent compatibility — the constructor effect drives the subscription. */
  init(): void { /* no-op */ }

  private subscribe(tripId: string | null): void {
    this.unsub?.(); this.unsub = undefined;
    if (!tripId) { this._flights.set([]); return; }
    runInInjectionContext(this.injector, () => {
      this.unsub = onSnapshot(collection(this.firestore, 'trips', tripId, 'flights'), snap => {
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
    await setDoc(ref, { ...data, id: ref.id });
  }

  async updateFlight(id: string, data: Partial<Omit<FlightDoc, 'id'>>): Promise<void> {
    const tid = this.requireTrip();
    await updateDoc(doc(this.firestore, 'trips', tid, 'flights', id), { ...data });
  }

  async deleteFlight(id: string): Promise<void> {
    const tid = this.requireTrip();
    await deleteDoc(doc(this.firestore, 'trips', tid, 'flights', id));
  }

  private requireTrip(): string {
    const tid = this.tripContext.activeTripId();
    if (!tid) throw new Error('No active trip selected.');
    return tid;
  }
}
