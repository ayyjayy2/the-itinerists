import { Injectable, signal, inject } from '@angular/core';
import { Firestore, collection, onSnapshot } from '@angular/fire/firestore';
import { FirestoreUser, TripUser } from '../models/trip.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private firestore = inject(Firestore);

  private _allUsers = signal<FirestoreUser[]>([]);
  readonly allUsers = this._allUsers.asReadonly();

  /** Maps Firestore users to the TripUser shape used across all existing pages. */
  readonly tripUsers = (): TripUser[] =>
    this._allUsers()
      .filter(u => !u.isDisabled)
      .map(u => ({
        uid:         u.uid,
        name:        u.displayName,
        color:       u.color,
        avatarEmoji: u.avatarEmoji,
      }));

  /** Start real-time listener on the users collection. Called once after login. */
  init(): void {
    onSnapshot(collection(this.firestore, 'users'), snap => {
      this._allUsers.set(
        snap.docs
          .map(d => d.data() as FirestoreUser)
          .filter(u => !u.isDisabled)
          .sort((a, b) => a.createdAt - b.createdAt)
      );
    });
  }
}
