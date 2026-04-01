import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { APP_VERSION, APP_BUILD_DATE } from '../../../version';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router      = inject(Router);

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
    } catch {
      this.error.set('Invalid username or password.');
      this.loading.set(false);
      return;
    }
    try {
      await this.userService.waitForUser();
      this.router.navigate(['/home']);
    } catch (err) {
      console.error('[Login] Profile load error:', err);
      this.error.set('Signed in but could not load profile. Please refresh.');
    } finally {
      this.loading.set(false);
    }
  }
}
