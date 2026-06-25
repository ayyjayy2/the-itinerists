import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';
import { APP_VERSION, APP_BUILD_DATE } from '../../../version';

const EMOJI_OPTIONS = [
  '🌸','🌿','✨','🦋','🐘','🌼','🍑','🌺','🦊','🐬',
  '🌙','⭐','🎵','🌈','🦁','🐻','🌻','🍀','🦅','🐙',
];

@Component({
  selector: 'app-join',
  imports: [CommonModule, FormsModule, RouterLink],
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

  readonly emojiOptions  = EMOJI_OPTIONS;
  readonly colorOptions  = ['#F4C2C2','#88C9A1','#D4B5F5','#F9E4B7','#F5B5D4','#B5D5F5','#F5D4B5','#B5F5D4'];

  inviteCode    = '';
  codeValid     = signal<boolean | null>(null); // null = checking
  codeError     = signal('');

  displayName   = '';
  avatarEmoji   = '🌸';
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

  selectEmoji(emoji: string): void {
    this.avatarEmoji = emoji;
  }

  selectColor(color: string): void {
    this.color = color;
  }

  async submit(): Promise<void> {
    this.error.set('');

    if (!this.displayName.trim()) { this.error.set('Please enter your name.'); return; }
    if (!this.username.trim())    { this.error.set('Please choose a username.'); return; }
    if (this.password.length < 6) { this.error.set('Password must be at least 6 characters.'); return; }
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
      );
      this.router.navigate(['/home']);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
