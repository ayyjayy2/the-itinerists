import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';
import { LocalCacheService } from '../../services/local-cache.service';
import { BrandComponent } from '../../shared/brand/brand.component';
import { userMessage } from '../../utils/user-message';

/**
 * Landing page for an invite link (/join?code=…). It never shows a form of
 * its own: someone already signed in is added to the trip and sent Home;
 * someone new is sent to the single sign-up form with the code filled in.
 * Without a code it just forwards to the right place.
 */
@Component({
  selector: 'app-join',
  imports: [BrandComponent, CommonModule, RouterLink],
  templateUrl: './join.component.html',
  styleUrl: './join.component.scss'
})
export class JoinComponent implements OnInit {
  private tripService = inject(TripService);
  private userService = inject(UserService);
  private router      = inject(Router);
  private route       = inject(ActivatedRoute);
  private localCache  = inject(LocalCacheService);

  codeError = signal('');
  step      = signal<'validating' | 'invalid'>('validating');

  async ngOnInit(): Promise<void> {
    const code = (this.route.snapshot.queryParams['code'] ?? '').trim().toUpperCase();
    await this.userService.authReadyPromise;

    if (this.userService.hasUser()) {
      if (!code) { this.router.navigate(['/get-started'], { queryParams: { mode: 'code' } }); return; }
      try {
        await this.tripService.joinByCode(code);
        this.router.navigate(['/home']);
      } catch (err) {
        if (this.localCache.recoverIfBroken(err)) return;
        this.step.set('invalid');
        this.codeError.set(userMessage(err, 'This invite code is invalid or has expired.'));
      }
      return;
    }

    this.router.navigate(['/signup'], code ? { queryParams: { code } } : {});
  }
}
