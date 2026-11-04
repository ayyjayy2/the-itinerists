import { Injectable, signal, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, onSnapshot } from '@angular/fire/firestore';
import { FirestoreUser, TripUser } from '../models/trip.models';
import { TripService } from './trip.service';
import { UserService } from './user.service';
import { returnedGuests } from '../utils/guest';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private tripService = inject(TripService);
  private userService = inject(UserService);

  private _allUsers = signal<FirestoreUser[]>([]);
  /** Every app user — app admins only (the rules refuse the list to anyone else). Empty otherwise. */
  readonly allUsers = this._allUsers.asReadonly();

  /**
   * People on the ACTIVE TRIP — its members. This is who expenses/splits,
   * "for who" pickers, and suggestions operate over. (Previously this wrongly
   * returned every app user, which pulled non-members into expense splits.)
   */
  /** The trip's people, each once: a guest who left and came back under the same name (#768) is one person. */
  readonly tripUsers = (): TripUser[] => {
    const members = this.tripService.activeMembers();
    const back = returnedGuests(members);
    return members.filter(m => !back.has(m.uid))
      .map(m => ({ uid: m.uid, name: m.displayName, color: m.color, avatarEmoji: m.avatarEmoji, avatarLetterColor: m.avatarLetterColor }));
  };

  init(): void {
    if (!this.userService.isAdmin()) { this._allUsers.set([]); return; }
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
