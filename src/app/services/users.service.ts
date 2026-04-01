import { Injectable, signal, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, onSnapshot } from '@angular/fire/firestore';
import { FirestoreUser, TripUser } from '../models/trip.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private firestore = inject(Firestore);
  private injector  = inject(Injector);

  private _allUsers = signal<FirestoreUser[]>([]);
  readonly allUsers = this._allUsers.asReadonly();

  readonly tripUsers = (): TripUser[] =>
    this._allUsers()
      .filter(u => !u.isDisabled)
      .map(u => ({ uid: u.uid, name: u.displayName, color: u.color, avatarEmoji: u.avatarEmoji }));

  init(): void {
    runInInjectionContext(this.injector, () => {
      onSnapshot(collection(this.firestore, 'users'), snap => {
        this._allUsers.set(
          snap.docs
            .map(d => d.data() as FirestoreUser)
            .filter(u => !u.isDisabled)
            .sort((a, b) => a.createdAt - b.createdAt)
        );
      });
    });
  }
}
