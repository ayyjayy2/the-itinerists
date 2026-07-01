import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';

/**
 * Post-auth onboarding prompt (TP-25). Shown when a signed-in user has no trips
 * yet: they can set up a trip, join one with an invite code, or skip into the
 * app and figure it out later.
 */
@Component({
  selector: 'app-get-started',
  imports: [CommonModule, FormsModule],
  templateUrl: './get-started.component.html',
  styleUrl: './get-started.component.scss',
})
export class GetStartedComponent {
  private tripService = inject(TripService);
  private userService = inject(UserService);
  private router      = inject(Router);

  readonly currentUser = this.userService.currentUser;

  /** Which panel is open: the choice menu, or the invite-code entry. */
  mode = signal<'choose' | 'code'>('choose');

  inviteCode = '';
  joining    = signal(false);
  error      = signal('');

  createTrip(): void {
    this.router.navigate(['/trips/new']);
  }

  openCodeEntry(): void {
    this.error.set('');
    this.mode.set('code');
  }

  backToChoices(): void {
    this.error.set('');
    this.mode.set('choose');
  }

  async joinWithCode(): Promise<void> {
    const code = this.inviteCode.trim().toUpperCase();
    if (!code) { this.error.set('Enter your invite code.'); return; }
    this.error.set('');
    this.joining.set(true);
    try {
      await this.tripService.joinByCode(code);
      this.router.navigate(['/home']);
    } catch (err: any) {
      this.error.set(err?.message ?? 'This invite code is invalid or has expired.');
    } finally {
      this.joining.set(false);
    }
  }

  doThisLater(): void {
    this.router.navigate(['/home']);
  }
}
