import { Location } from '@angular/common';
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { LocalCacheService } from '../../services/local-cache.service';
import { BrandComponent } from '../../shared/brand/brand.component';
import { userMessage } from '../../utils/user-message';

/**
 * Landing page for an invite link (/join?code=…). Someone already signed in
 * is added to the trip and sent Home. Someone new sees the plan without an
 * account (#610): they give a name and join as a guest, and are asked to
 * create an account only when they want to add or change something. They can
 * still create one straight away (the sign-up form, with the code filled in).
 * Without a code it just forwards to the right place.
 */
@Component({
  selector: 'app-join',
  imports: [BrandComponent, CommonModule, FormsModule, RouterLink],
  templateUrl: './join.component.html',
  styleUrl: './join.component.scss'
})
export class JoinComponent implements OnInit {
  private tripService = inject(TripService);
  private userService = inject(UserService);
  private router      = inject(Router);
  private route       = inject(ActivatedRoute);
  private localCache  = inject(LocalCacheService);
  private location    = inject(Location);
  private authService = inject(AuthService);

  codeError = signal('');
  step      = signal<'validating' | 'invalid' | 'guest'>('validating');
  /** The guest step: their name, and the busy and error states of "See the trip". */
  guestName = '';
  joining   = signal(false);
  nameError = signal('');
  private code = '';

  async ngOnInit(): Promise<void> {
    const code = (this.route.snapshot.queryParams['code'] ?? '').trim().toUpperCase();
    // An invite code admits people for a week: take it out of the address bar
    // straight away, so analytics, history and shared screenshots never keep it.
    if (code) this.location.replaceState('/join');
    await this.userService.authReadyPromise;

    if (this.userService.hasUser()) {
      if (!code) { this.router.navigate(['/get-started'], { queryParams: { mode: 'code' } }); return; }
      try {
        await this.tripService.joinByCode(code, 'link');
        this.router.navigate(['/home']);
      } catch (err) {
        if (this.localCache.recoverIfBroken(err)) return;
        this.step.set('invalid');
        this.codeError.set(userMessage(err, 'This invite code is invalid or has expired.'));
      }
      return;
    }

    if (!code) { this.router.navigate(['/signup']); return; }
    this.code = code;
    this.step.set('guest');
  }

  /** Join as a guest with just a name (#610), then open the trip. */
  async seeTheTrip(): Promise<void> {
    if (this.joining()) return;
    if (!this.guestName.trim()) { this.nameError.set('Enter your name so the group knows who you are.'); return; }
    this.nameError.set('');
    this.joining.set(true);
    try {
      await this.authService.joinAsGuest(this.code, this.guestName);
      await this.userService.waitForUser();
      await this.router.navigate(['/home']);
    } catch (err) {
      if (this.localCache.recoverIfBroken(err)) return;
      this.joining.set(false);
      this.nameError.set(userMessage(err, "Couldn't open the trip. Check your connection and try again."));
    }
  }

  /** Create an account straight away instead: the sign-up form, code handed over privately (not in the address). */
  createAccount(): void {
    this.router.navigate(['/signup'], { state: { inviteCode: this.code } });
  }
}
