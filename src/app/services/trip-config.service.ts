import { Injectable, signal, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, onSnapshot } from '@angular/fire/firestore';
import { TripConfig } from '../models/trip.models';

@Injectable({ providedIn: 'root' })
export class TripConfigService {
  private firestore = inject(Firestore);
  private injector  = inject(Injector);

  private _config = signal<TripConfig | null>(null);
  readonly config = this._config.asReadonly();

  init(): void {
    runInInjectionContext(this.injector, () => {
      onSnapshot(doc(this.firestore, 'app/tripConfig'), snap => {
        this._config.set(snap.exists() ? (snap.data() as TripConfig) : null);
      });
    });
  }
}
