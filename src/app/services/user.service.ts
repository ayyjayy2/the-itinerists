import { Injectable, signal, inject, computed } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, onSnapshot } from '@angular/fire/firestore';
import { TripUser, FirestoreUser } from '../models/trip.models';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class UserService {
  private auth      = inject(Auth);
  private firestore = inject(Firestore);

  private _firestoreUser = signal<FirestoreUser | null>(null);
  private _authReady     = signal(false);

  readonly firestoreUser = this._firestoreUser.asReadonly();
  readonly authReady     = this._authReady.asReadonly();

  /** Matches the existing TripUser shape so all pages continue to work unchanged. */
  readonly currentUser = computed<TripUser | null>(() => {
    const u = this._firestoreUser();
    if (!u) return null;
    return {
      uid:         u.uid,
      name:        u.displayName,
      color:       u.color,
      avatarEmoji: u.avatarEmoji,
    };
  });

  readonly isAdmin = computed(() => this._firestoreUser()?.isAdmin ?? false);

  hasUser(): boolean {
    return this._firestoreUser() !== null;
  }

  /** Promise that resolves once the first Firebase Auth state has been determined. */
  readonly authReadyPromise: Promise<void>;

  constructor() {
    let resolveReady!: () => void;
    this.authReadyPromise = new Promise(res => resolveReady = res);

    // Listen to Firebase Auth state
    authState(this.auth).subscribe(firebaseUser => {
      if (!firebaseUser) {
        this._firestoreUser.set(null);
        this._authReady.set(true);
        resolveReady();
        return;
      }

      // Auth user is present — load their Firestore profile
      onSnapshot(doc(this.firestore, 'users', firebaseUser.uid), snap => {
        if (snap.exists()) {
          const data = snap.data() as FirestoreUser;
          if (data.isDisabled) {
            // Treat disabled accounts as logged out
            this._firestoreUser.set(null);
          } else {
            this._firestoreUser.set(data);
          }
        } else {
          this._firestoreUser.set(null);
        }
        if (!this._authReady()) {
          this._authReady.set(true);
          resolveReady();
        }
      });
    });
  }
}
