import { Injectable, inject, signal } from '@angular/core';
import { UserService } from './user.service';

/**
 * A guest (#610) reads the trip; the first time they try to add or change
 * something they're asked to create an account instead. Every control that
 * changes the trip carries `data-needs-account`; one listener on the page,
 * ahead of the control's own, stops a guest's tap or submit there and opens
 * the account sheet (shared/account-sheet). The security rules refuse a
 * guest's write anyway; this is so they're asked rather than shown an error.
 */
@Injectable({ providedIn: 'root' })
export class AccountPromptService {
  private user = inject(UserService);
  /** Whether the "Create your account" sheet is open. */
  readonly open = signal(false);
  private started = false;

  /** Called once from the root component. */
  start(): void {
    if (this.started || typeof document === 'undefined') return;
    this.started = true;
    for (const type of ['click', 'submit'] as const) {
      document.addEventListener(type, e => this.intercept(e), true);
    }
  }

  /** Open the sheet from code (a page that knows the person is a guest). */
  ask(): void { this.open.set(true); }

  private intercept(e: Event): void {
    if (!this.user.isGuest()) return;
    const target = e.target as Element | null;
    if (!target?.closest?.('[data-needs-account]')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.open.set(true);
  }
}
