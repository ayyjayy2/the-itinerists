/**
 * Demo-build stand-in for `@angular/fire/auth`.
 *
 * The demo starts signed in as the seeded traveller. Signing out works; signing
 * back in with any username and password signs in as that same traveller.
 * Self-serve signup mints a throwaway uid so the flow completes in memory.
 * Password and email helpers resolve without doing anything.
 */
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { demoStore } from './fire-firestore';
import { DEMO_UID, DEMO_EMAIL } from './seed-constants';

export interface User {
  uid: string;
  email: string | null;
}

export interface UserCredential {
  user: User;
}

export interface AuthCredential {
  email: string;
  password: string;
}

export class Auth {
  private readonly subject = new BehaviorSubject<User | null>({ uid: DEMO_UID, email: DEMO_EMAIL });

  get currentUser(): User | null { return this.subject.value; }
  get user$(): Observable<User | null> { return this.subject.asObservable(); }

  setUser(user: User | null): void { this.subject.next(user); }
}

const demoAuth = new Auth();

export function getAuth(_app?: unknown): Auth { return demoAuth; }
export function provideAuth(factory: () => Auth): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: Auth, useFactory: factory }]);
}
export function authState(auth: Auth): Observable<User | null> { return auth.user$; }

export async function signInWithEmailAndPassword(auth: Auth, _email: string, _password: string): Promise<UserCredential> {
  const user: User = { uid: DEMO_UID, email: DEMO_EMAIL };
  auth.setUser(user);
  return { user };
}

export async function createUserWithEmailAndPassword(auth: Auth, email: string, _password: string): Promise<UserCredential> {
  const user: User = { uid: demoStore.autoId(), email };
  auth.setUser(user);
  return { user };
}

export async function signOut(auth: Auth): Promise<void> { auth.setUser(null); }
export async function sendPasswordResetEmail(_auth: Auth, _email: string): Promise<void> { /* demo: nothing to send */ }
export async function updateEmail(user: User, email: string): Promise<void> { user.email = email; }
export async function updatePassword(_user: User, _password: string): Promise<void> { /* demo: accepted */ }
export async function reauthenticateWithCredential(_user: User, _cred: AuthCredential): Promise<void> { /* demo: accepted */ }

export const EmailAuthProvider = {
  credential(email: string, password: string): AuthCredential { return { email, password }; },
};
