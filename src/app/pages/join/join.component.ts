import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';
import { APP_VERSION, APP_BUILD_DATE } from '../../../version';
import { BrandComponent } from '../../shared/brand/brand.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { AvatarPickerComponent } from '../../shared/avatar-picker/avatar-picker.component';
import { passwordRules, isPasswordValid, passwordProblems } from '../../utils/password';
import { isValidEmail } from '../../utils/email';

@Component({
  selector: 'app-join',
  imports: [BrandComponent, IconComponent, CommonModule, FormsModule, RouterLink, AvatarPickerComponent],
  templateUrl: './join.component.html',
  styleUrl: './join.component.scss'
})
export class JoinComponent implements OnInit {
  private authService = inject(AuthService);
  private tripService = inject(TripService);
  private userService = inject(UserService);
  private router      = inject(Router);
  private route       = inject(ActivatedRoute);

  readonly version   = APP_VERSION;
  readonly buildDate = APP_BUILD_DATE;

  inviteCode    = '';
  codeValid     = signal<boolean | null>(null); // null = checking
  codeError     = signal('');

  displayName   = '';
  avatarEmoji   = '🌸';
  avatarLetterColor = '';
  email         = '';
  username      = '';
  password      = '';
  confirmPass   = '';
  color         = '#F4C2C2';

  showPassword  = signal(false);
  loading       = signal(false);
  error         = signal('');
  step          = signal<'validating' | 'form' | 'invalid'>('validating');

  async ngOnInit(): Promise<void> {
    this.inviteCode = this.route.snapshot.queryParams['code'] ?? '';

    // Already signed in? Resolve the code and join the trip directly (TP-11).
    if (this.inviteCode && this.userService.hasUser()) {
      this.step.set('validating');
      try {
        await this.tripService.joinByCode(this.inviteCode);
        this.router.navigate(['/home']);
        return;
      } catch (err: any) {
        this.step.set('invalid');
        this.codeError.set(err?.message ?? 'This invite code is invalid or has expired.');
        return;
      }
    }

    if (this.inviteCode) {
      this.validateCode();
    } else {
      this.step.set('form'); // manual code entry
    }
  }

  async validateCode(): Promise<void> {
    this.step.set('validating');
    try {
      const tripId = await this.authService.validateInviteCode(this.inviteCode.trim().toUpperCase());
      if (tripId) {
        this.step.set('form');
      } else {
        this.step.set('invalid');
        this.codeError.set('This invite code is invalid or has already been used.');
      }
    } catch {
      this.step.set('invalid');
      this.codeError.set('Could not validate the invite code. Please try again.');
    }
  }

  /** Live password-requirement checklist for the template. */
  get passwordChecklist() {
    return passwordRules(this.password);
  }

  async submit(): Promise<void> {
    this.error.set('');

    if (!this.displayName.trim()) { this.error.set('Please enter your name.'); return; }
    if (!this.username.trim())    { this.error.set('Please choose a username.'); return; }
    if (!isValidEmail(this.email)) { this.error.set('Please enter a valid email address.'); return; }
    if (!isPasswordValid(this.password)) { this.error.set(passwordProblems(this.password)); return; }
    if (this.password !== this.confirmPass) { this.error.set('Passwords do not match.'); return; }

    this.loading.set(true);
    try {
      await this.authService.register(
        this.inviteCode.trim().toUpperCase(),
        this.displayName.trim(),
        this.avatarEmoji,
        this.username.trim(),
        this.password,
        this.color,
        this.avatarLetterColor,
        this.email.trim(),
      );
      this.router.navigate(['/home']);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
