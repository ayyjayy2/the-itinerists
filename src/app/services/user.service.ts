import { Injectable, signal } from '@angular/core';
import { TripUser } from '../models/trip.models';

const SESSION_KEY = 'ireland_session_user';   // sessionStorage — tab-specific
const HINT_KEY    = 'ireland_last_user_hint'; // localStorage — pre-highlights user-select

@Injectable({ providedIn: 'root' })
export class UserService {
  private _currentUser = signal<TripUser | null>(this.loadFromStorage());

  readonly currentUser = this._currentUser.asReadonly();

  setUser(user: TripUser): void {
    this._currentUser.set(user);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    localStorage.setItem(HINT_KEY, user.name);
  }

  clearUser(): void {
    this._currentUser.set(null);
    sessionStorage.removeItem(SESSION_KEY);
  }

  hasUser(): boolean {
    return this._currentUser() !== null;
  }

  getLastUserHint(): string | null {
    return localStorage.getItem(HINT_KEY);
  }

  private loadFromStorage(): TripUser | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
