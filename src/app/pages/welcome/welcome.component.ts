import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BrandComponent } from '../../shared/brand/brand.component';
import { WaitlistService } from '../../services/waitlist.service';
import { isValidEmail } from '../../utils/email';

interface Clip { src: string; poster: string; label: string; }

/**
 * The first page for people who aren't signed in (website only; the iPhone
 * app and invite links skip it). A few seconds of each key screen, from the
 * demo build's made-up trip, the iPhone app as the headline, and a quieter
 * way to carry on in the browser.
 */
@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [FormsModule, RouterLink, BrandComponent],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
})
export class WelcomeComponent {
  private waitlist = inject(WaitlistService);

  readonly clips: Clip[] = [
    { src: '/welcome/home.mp4',      poster: '/welcome/home.jpg',      label: 'Your trip at a glance' },
    { src: '/welcome/money.mp4',     poster: '/welcome/money.jpg',     label: 'Costs split, no awkward maths' },
    { src: '/welcome/itinerary.mp4', poster: '/welcome/itinerary.jpg', label: 'One plan everyone can see' },
  ];
  readonly current = signal(0);
  /** Respect reduced motion: show each clip's still frame, no autoplay. */
  readonly reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  email = '';
  readonly error   = signal('');
  readonly sending = signal(false);
  readonly joined  = signal(this.waitlist.joined());

  /** The clip strip scrolled: light the matching dot. */
  onScroll(strip: HTMLElement): void {
    this.current.set(Math.round(strip.scrollLeft / Math.max(strip.clientWidth, 1)));
  }

  goTo(strip: HTMLElement, i: number): void {
    strip.scrollTo({ left: i * strip.clientWidth, behavior: 'smooth' });
  }

  async notifyMe(): Promise<void> {
    const email = this.email.trim().toLowerCase();
    if (!isValidEmail(email)) { this.error.set('Enter your email, like you@example.com.'); return; }
    this.error.set('');
    this.sending.set(true);
    try {
      await this.waitlist.join(email);
      this.joined.set(true);
    } catch {
      this.error.set("We couldn't add you just now. Check your connection and try again.");
    } finally {
      this.sending.set(false);
    }
  }
}
