import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { TripService } from '../../services/trip.service';
import { APP_VERSION, APP_BUILD_DATE } from '../../../version';
import { BrandComponent } from '../../shared/brand/brand.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { userMessage, isBrokenLocalCacheError } from '../../utils/user-message';
import { LocalCacheService } from '../../services/local-cache.service';

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

  username     = '';
  password     = '';
  showPassword = signal(false);
  loading      = signal(false);
  error        = signal('');

  async submit(): Promise<void> {
    if (!this.username.trim() || !this.password) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.authService.login(this.username.trim(), this.password);
    } catch (err) {
      if (this.localCache.recoverIfBroken(err)) return;
      this.error.set(isBrokenLocalCacheError(err) ? userMessage(err, '') : 'Invalid username, email, or password.');
      this.loading.set(false);
      return;
    }
    // Don't wait for the profile or the trip list here — Home shows its own
    // spinner while they stream in, and its no-trip state covers first-timers.
    // That takes two round trips off the time between "Sign in" and a screen.
    this.router.navigate(['/home']);
    this.loading.set(false);
  }
}
