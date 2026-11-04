import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, UseEmailToSignInError } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { TripService } from '../../services/trip.service';
import { APP_VERSION, APP_BUILD_DATE } from '../../../version';
import { BrandComponent } from '../../shared/brand/brand.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { EyeButtonDirective } from '../../shared/eye-button.directive';
import { userMessage, isBrokenLocalCacheError, isTooManyAttempts, TOO_MANY_ATTEMPTS_MESSAGE } from '../../utils/user-message';
import { LocalCacheService } from '../../services/local-cache.service';
import { SESSION_EXPIRED_MESSAGE } from '../../utils/session';
import { ErrorLoggerService } from '../../services/error-logger.service';
import { NATIVE_PLATFORM } from '../../native-platform';

/** Sign-in couldn't load the account in time (#703). */
export const SIGN_IN_STALLED_MESSAGE = "We couldn't reach your account just now. Check your connection, then sign in again.";

@Component({
  selector: 'app-login',
  imports: [BrandComponent, IconComponent, EyeButtonDirective, CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private tripService = inject(TripService);
  private router      = inject(Router);
  private localCache  = inject(LocalCacheService);
  private logger      = inject(ErrorLoggerService);
  private native      = inject(NATIVE_PLATFORM);

  readonly version   = APP_VERSION;
  readonly buildDate = APP_BUILD_DATE;

  email        = '';
  password     = '';
  showPassword = signal(false);
  loading      = signal(false);
  error        = signal('');
  /** Why the person is here, when the app signed them out after 90 days. */
  readonly notice = signal('');

  constructor() {
    if (this.userService.sessionEnded()) {
      this.notice.set(SESSION_EXPIRED_MESSAGE);
      this.userService.sessionEnded.set(false);
    }
    if (this.userService.signInStalled()) {
      this.notice.set(SIGN_IN_STALLED_MESSAGE);
      this.userService.signInStalled.set(false);
    }
  }

  async submit(): Promise<void> {
    if (!this.email.trim() || !this.password) return;
    this.loading.set(true);
    this.error.set('');
    // A sign-in that hangs leaves a note of the step it's stuck on (#712); the
    // note is sent when the connection allows, so a hang on the phone shows up.
    const started = Date.now();
    let step = 'checking the password';
    const watch = setTimeout(() => this.logger.logDiagnostic(`sign-in still waiting after 10 s while ${step} (${this.native ? 'iPhone app' : 'web'})`), 10_000);
    try {
      await this.authService.login(this.email.trim(), this.password);
    } catch (err) {
      clearTimeout(watch);
      if (this.localCache.recoverIfBroken(err)) return;
      this.error.set(
        err instanceof UseEmailToSignInError ? err.message
        : isBrokenLocalCacheError(err) ? userMessage(err, '')
        : isTooManyAttempts(err) ? TOO_MANY_ATTEMPTS_MESSAGE
        : 'Wrong email or password. Check them and try again.');
      this.loading.set(false);
      return;
    }
    // Don't wait for the profile or the trip list here — Home shows its own
    // spinner while they stream in, and its no-trip state covers first-timers.
    // The button keeps saying "Signing in…" until Home is on screen, so there
    // is never a moment where it looks like nothing happened.
    step = 'loading the profile and Home';
    const passwordMs = Date.now() - started;
    const ok = await this.router.navigate(['/home']).catch(() => false);
    clearTimeout(watch);
    const totalMs = Date.now() - started;
    if (totalMs > 5000) this.logger.logDiagnostic(`slow sign-in: password ${passwordMs} ms, then profile and Home ${totalMs - passwordMs} ms (${this.native ? 'iPhone app' : 'web'})`);
    if (!ok) this.loading.set(false);
  }
}
