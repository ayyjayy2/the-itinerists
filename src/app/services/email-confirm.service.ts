import { Injectable, effect, inject, signal } from '@angular/core';
import { Auth, sendEmailVerification, reload } from '@angular/fire/auth';
import { UserService } from './user.service';
import { needsEmailConfirmation } from '../utils/email';

/**
 * Gentle email confirmation. A confirmation link goes out at sign-up, but
 * nothing ever waits on it: the person signs up and uses the app straight
 * away, and Home shows a small reminder with a Resend button until the link
 * is tapped. Confirming happens in the email, so the app re-checks whenever it
 * comes back to the foreground.
 */
@Injectable({ providedIn: 'root' })
export class EmailConfirmService {
  private auth = inject(Auth);
  private userService = inject(UserService);

  /** The address still waiting to be confirmed, or '' once confirmed (or nothing to confirm). */
  private _waiting = signal('');
  readonly waiting = this._waiting.asReadonly();
  /** When a link was last sent from this device (sign-up or Resend). */
  private _sentAt = signal(0);
  readonly sentAt = this._sentAt.asReadonly();

  constructor() {
    effect(() => { this.userService.currentUser(); void this.refresh(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this._waiting()) void this.refresh();
    });
  }

  /** Send the confirmation link. Never throws: a failed send must not stop anyone. */
  async send(): Promise<boolean> {
    const user = this.auth.currentUser;
    if (!user || !needsEmailConfirmation(user.email, user.emailVerified)) return false;
    try {
      await sendEmailVerification(user);
      this._sentAt.set(Date.now());
      return true;
    } catch (err) {
      console.warn('[EmailConfirm] link not sent:', (err as Error)?.message ?? err);
      return false;
    }
  }

  /** Re-read the account (the link is tapped in the email, outside the app). */
  async refresh(): Promise<void> {
    const user = this.auth.currentUser;
    if (user && needsEmailConfirmation(user.email, user.emailVerified)) {
      try { await reload(user); } catch { /* offline: try again next time */ }
    }
    const now = this.auth.currentUser;
    this._waiting.set(now && needsEmailConfirmation(now.email, now.emailVerified) ? now.email! : '');
  }
}
