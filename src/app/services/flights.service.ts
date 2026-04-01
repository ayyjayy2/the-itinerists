import { Injectable, signal, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, deleteDoc } from '@angular/fire/firestore';
import { FlightDoc } from '../models/trip.models';

@Injectable({ providedIn: 'root' })
export class FlightsService {
  private firestore = inject(Firestore);
  private injector  = inject(Injector);

  private _flights = signal<FlightDoc[]>([]);
  readonly flights = this._flights.asReadonly();

  init(): void {
    runInInjectionContext(this.injector, () => {
      onSnapshot(collection(this.firestore, 'flights'), snap => {
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
    const ref = doc(collection(this.firestore, 'flights'));
    await setDoc(ref, { ...data, id: ref.id });
  }

  async deleteFlight(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'flights', id));
  }
}
