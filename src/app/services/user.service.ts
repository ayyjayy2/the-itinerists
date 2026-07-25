import { Injectable, signal, inject, computed, Injector, runInInjectionContext } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, onSnapshot, updateDoc } from '@angular/fire/firestore';
import { TripUser, FirestoreUser } from '../models/trip.models';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, map, merge } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserService {
  private auth      = inject(Auth);
  private firestore = inject(Firestore);
  private injector  = inject(Injector);

  private _firestoreUser   = signal<FirestoreUser | null>(null);
  private _authInitialized = signal(false);
  private _userLoadError   = signal<Error | null>(null);

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
  private readonly userLoadError$ = toObservable(this._userLoadError);

  // Rejects if the profile listener errors (e.g. rules/App Check denial) — callers
  // show their error state instead of spinning forever on a user that never comes.
  waitForUser(): Promise<TripUser> {
    return firstValueFrom(
      merge(
        this.currentUser$.pipe(filter((u): u is TripUser => u !== null)),
        this.userLoadError$.pipe(
          filter((e): e is Error => e !== null),
          map(e => { throw e; }),
        ),
      )
    );
  }

  /** Persist Home pins on the account (personalization follows the user across devices). */
  async updateHomePins(pins: string[]): Promise<void> {
    const uid = this._firestoreUser()?.uid;
    if (!uid) return;
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'users', uid), { homePins: pins }));
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
            this._userLoadError.set(null);
            if (!initialized) { initialized = true; this._authInitialized.set(true); resolveReady(); }
          }, err => {
            // A denied listen (rules, App Check) otherwise fails silently and the
            // listener stops — surface it so waitForUser() rejects and guards unblock.
            console.error(`[UserService] users/${firebaseUser.uid} listener error:`, err);
            this._firestoreUser.set(null);
            this._userLoadError.set(err);
            if (!initialized) { initialized = true; this._authInitialized.set(true); resolveReady(); }
          });
        });
      });
    });
  }
}
