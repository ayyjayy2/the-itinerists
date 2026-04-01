import { Injectable, signal, inject, computed, Injector, runInInjectionContext } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, onSnapshot } from '@angular/fire/firestore';
import { TripUser, FirestoreUser } from '../models/trip.models';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserService {
  private auth      = inject(Auth);
  private firestore = inject(Firestore);
  private injector  = inject(Injector);

  private _firestoreUser   = signal<FirestoreUser | null>(null);
  private _authInitialized = signal(false);

  readonly firestoreUser   = this._firestoreUser.asReadonly();
  readonly authInitialized = this._authInitialized.asReadonly();

  readonly currentUser = computed<TripUser | null>(() => {
    const u = this._firestoreUser();
    if (!u) return null;
    return { uid: u.uid, name: u.displayName, color: u.color, avatarEmoji: u.avatarEmoji };
  });

  readonly isAdmin = computed(() => this._firestoreUser()?.isAdmin ?? false);

  hasUser(): boolean { return this._firestoreUser() !== null; }

  readonly authReadyPromise: Promise<void>;
  private readonly currentUser$ = toObservable(this.currentUser);

  waitForUser(): Promise<TripUser> {
    return firstValueFrom(
      this.currentUser$.pipe(filter((u): u is TripUser => u !== null))
    );
  }

  constructor() {
    let resolveReady!: () => void;
    this.authReadyPromise = new Promise(res => (resolveReady = res));
    let initialized = false;

    runInInjectionContext(this.injector, () => {
      authState(this.auth).subscribe(firebaseUser => {
        if (!firebaseUser) {
          this._firestoreUser.set(null);
          if (!initialized) { initialized = true; this._authInitialized.set(true); resolveReady(); }
          return;
        }

        runInInjectionContext(this.injector, () => {
          onSnapshot(doc(this.firestore, 'users', firebaseUser.uid), snap => {
            if (snap.exists()) {
              const data = snap.data() as FirestoreUser;
              this._firestoreUser.set(data.isDisabled ? null : data);
            } else {
              this._firestoreUser.set(null);
            }
            if (!initialized) { initialized = true; this._authInitialized.set(true); resolveReady(); }
          });
        });
      });
    });
  }
}
