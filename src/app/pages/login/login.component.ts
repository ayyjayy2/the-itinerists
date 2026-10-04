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
import { userMessage, isBrokenLocalCacheError } from '../../utils/user-message';
import { LocalCacheService } from '../../services/local-cache.service';
import { SESSION_EXPIRED_MESSAGE } from '../../utils/session';

@Component({
  selector: 'app-login',
  imports: [BrandComponent, IconComponent, CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private tripService = inject(TripService);
  private router      = inject(Router);
  private localCache  = inject(LocalCacheService);

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
  }

  async submit(): Promise<void> {
    if (!this.email.trim() || !this.password) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.authService.login(this.email.trim(), this.password);
    } catch (err) {
      if (this.localCache.recoverIfBroken(err)) return;
      this.error.set(
        err instanceof UseEmailToSignInError ? err.message
        : isBrokenLocalCacheError(err) ? userMessage(err, '')
        : 'Wrong email or password. Check them and try again.');
      this.loading.set(false);
      return;
    }
    // Don't wait for the profile or the trip list here — Home shows its own
    // spinner while they stream in, and its no-trip state covers first-timers.
    // The button keeps saying "Signing in…" until Home is on screen, so there
    // is never a moment where it looks like nothing happened.
    const ok = await this.router.navigate(['/home']).catch(() => false);
    if (!ok) this.loading.set(false);
  }
}
