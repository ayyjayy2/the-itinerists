import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService, UseEmailToSignInError } from '../../services/auth.service';
import { BrandComponent } from '../../shared/brand/brand.component';
import { maskEmail } from '../../utils/email';
import { isTooManyAttempts, TOO_MANY_ATTEMPTS_MESSAGE } from '../../utils/user-message';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink, BrandComponent],
  template: `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-header">
          <app-brand variant="stacked" [mark]="56" />
          <p class="auth-sub">Reset your password</p>
        </div>

        @if (sentTo()) {
          <p class="reset-info">If an account uses <strong>{{ sentTo() }}</strong>, a reset link is on its way.
            Follow it to choose a new password, then sign in here. Nothing after a few minutes? Check your spam folder.</p>
        } @else if (noRecovery()) {
          <p class="reset-info">No recovery email is on file for this account, so a reset link can't be sent.
            Email <a href="mailto:support&#64;theitinerists.com">support&#64;theitinerists.com</a> from any address
            and we'll get you back in.</p>
        } @else {
          <p class="reset-hint">Enter the email you sign in with and we'll send a reset link there.</p>
          <form class="auth-form" (ngSubmit)="submit()">
            <div class="form-group">
              <label for="email">Email</label>
              <input id="email" type="email" inputmode="email" [(ngModel)]="email" name="email"
                     placeholder="you@example.com" autocomplete="username"
                     autocapitalize="none" spellcheck="false" required />
            </div>
            @if (error()) {
              <div class="auth-error">{{ error() }}</div>
            }
            <button type="submit" class="btn btn-primary auth-btn"
                    [disabled]="loading() || !email.trim()">
              {{ loading() ? 'Sending…' : 'Send reset link' }}
            </button>
          </form>
        }

        <div class="auth-footer">
          <p><a routerLink="/login">Back to sign in</a></p>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['../login/login.component.scss'],
  styles: [`
    .reset-hint, .reset-info { font-size: 0.92rem; line-height: 1.5; margin: 0 0 1rem; }
    .reset-info { text-align: center; a { color: var(--primary-dark); font-weight: 700; } }
  `],
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);

  email      = '';
  loading    = signal(false);
  error      = signal('');
  sentTo     = signal('');
  noRecovery = signal(false);

  async submit(): Promise<void> {
    if (!this.email.trim()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const sentTo = await this.authService.sendPasswordReset(this.email);
      if (sentTo === null) this.noRecovery.set(true);
      else this.sentTo.set(maskEmail(sentTo));
    } catch (err: any) {
      // Never say whether an account uses the address: a "not found" (only possible if
      // Firebase's email enumeration protection were switched off) gets the same answer
      // as a sent link (#405).
      if (err?.code === 'auth/user-not-found') { this.sentTo.set(maskEmail(this.email.trim().toLowerCase())); return; }
      this.error.set(err instanceof UseEmailToSignInError ? err.message
        : isTooManyAttempts(err) ? TOO_MANY_ATTEMPTS_MESSAGE
        : 'Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
