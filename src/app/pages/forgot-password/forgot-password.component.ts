import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BrandComponent } from '../../shared/brand/brand.component';
import { maskEmail } from '../../utils/email';

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
          <p class="reset-info">Reset link sent to <strong>{{ sentTo() }}</strong>.
            Follow it to choose a new password, then sign in here.</p>
        } @else if (noRecovery()) {
          <p class="reset-info">No recovery email is on file for this account —
            ask an admin to reset your password.</p>
        } @else {
          <p class="reset-hint">Enter your username or recovery email. If a recovery
            email is on file, we'll send a reset link there.</p>
          <form class="auth-form" (ngSubmit)="submit()">
            <div class="form-group">
              <label for="username">Username or email</label>
              <input id="username" type="text" [(ngModel)]="username" name="username"
                     placeholder="Username or recovery email" autocomplete="username"
                     autocapitalize="none" required />
            </div>
            @if (error()) {
              <div class="auth-error">{{ error() }}</div>
            }
            <button type="submit" class="btn btn-primary auth-btn"
                    [disabled]="loading() || !username.trim()">
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
    .reset-info { text-align: center; }
  `],
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);

  username   = '';
  loading    = signal(false);
  error      = signal('');
  sentTo     = signal('');
  noRecovery = signal(false);

  async submit(): Promise<void> {
    if (!this.username.trim()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const email = await this.authService.sendPasswordReset(this.username);
      if (email === null) this.noRecovery.set(true);
      else this.sentTo.set(maskEmail(email));
    } catch (err: any) {
      this.error.set(err?.code === 'auth/user-not-found'
        ? 'No account uses that email.'
        : 'Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
