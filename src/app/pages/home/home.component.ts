import { Component, OnInit, OnDestroy, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';
import { UserService } from '../../services/user.service';
import { FlightCountdownService } from '../../services/flight-countdown.service';
import { FlightsService } from '../../services/flights.service';
import { TripService } from '../../services/trip.service';

interface QuickLink {
  path: string;
  label: string;
  icon: string;
  description: string;
  color: string;
}

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  userService     = inject(UserService);
  flightCountdown = inject(FlightCountdownService);
  flightsService  = inject(FlightsService);
  tripService     = inject(TripService);

  currentUser = this.userService.currentUser;
  isAdmin     = this.userService.isAdmin;

  /** The active trip drives the home dashboard (TP-14). */
  readonly activeTrip    = this.tripService.activeTrip;
  readonly hasActiveTrip = computed(() => this.activeTrip() !== null);

  private now = signal(Date.now());
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  // `icon` is an <app-icon> name (custom line-icon set); `color` tints the card's top accent.
  private readonly baseLinks: QuickLink[] = [
    { path: '/flights',        label: 'Flights',      icon: 'flights',   description: 'Arrivals & departures', color: 'var(--primary)' },
    { path: '/itinerary',      label: 'Itinerary',    icon: 'itinerary', description: 'Day-by-day plans',      color: 'var(--accent)' },
    { path: '/accommodations', label: 'Stays',        icon: 'stays',     description: 'Hotels & check-in',     color: 'var(--lavender)' },
    { path: '/finance',        label: 'Finance',      icon: 'finance',   description: 'Shared expenses',       color: 'var(--primary)' },
    { path: '/recs',           label: 'Recs',         icon: 'recs',      description: 'Local tips & spots',    color: 'var(--highlight)' },
    { path: '/packing',        label: 'Packing',      icon: 'packing',   description: 'Your packing list',     color: 'var(--accent)' },
    { path: '/outfits',        label: 'Outfits',      icon: 'outfits',   description: 'Plan your looks',       color: 'var(--highlight)' },
    { path: '/profile',        label: 'Profile',      icon: 'profile',   description: 'Settings & account',    color: 'var(--lavender)' },
  ];

  readonly quickLinks = computed(() => {
    // Respect the member's hidden pages for the active trip (TP-15).
    const hidden = this.tripService.hiddenPages();
    const links = this.baseLinks.filter(l => !hidden.includes(l.path.slice(1)));
    return this.isAdmin()
      ? [...links, { path: '/admin', label: 'Admin', icon: 'admin', description: 'Trip & members', color: 'var(--lavender)' }]
      : links;
  });

  /** Short destination for countdown copy: "Lisbon, Portugal" → "Lisbon". */
  readonly destinationShort = computed(() => {
    const trip = this.activeTrip();
    if (!trip) return '';
    return (trip.destination || trip.name || '').split(',')[0].trim();
  });

  /** Hero subtitle. */
  readonly locationLabel = computed(() => {
    const trip = this.activeTrip();
    if (!trip) return 'plan your next adventure';
    return trip.destination || trip.name || 'your trip';
  });

  readonly flightLabel = computed(() => {
    const uid     = this.currentUser()?.uid ?? '';
    const flights = this.flightsService.flights();
    this.now(); // subscribe to timer ticks
    return this.flightCountdown.getCountdownForUid(uid, flights);
  });

  readonly countdown = computed(() => {
    const trip = this.activeTrip();
    const now  = new Date(this.now());

    if (!trip) {
      return { label: 'No active trip — pick one in My Trips', type: 'unset' };
    }
    if (!trip.startDate || !trip.endDate) {
      return { label: 'Trip dates not set yet', type: 'unset' };
    }

    const where     = this.destinationShort() || 'your trip';
    const tripStart = new Date(trip.startDate + 'T00:00:00');
    const tripEnd   = new Date(trip.endDate   + 'T00:00:00');
    const diff      = tripStart.getTime() - now.getTime();

    if (diff <= 0) {
      const remaining = tripEnd.getTime() - now.getTime();
      if (remaining > 0) {
        const days = Math.ceil(remaining / (1000 * 60 * 60 * 24));
        return { label: `Trip is live! ${days} day${days !== 1 ? 's' : ''} left 🌿`, type: 'live' };
      }
      return { label: `${trip.name} complete! 🌿`, type: 'done' };
    }

    const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return { label: `${days}d ${hours}h until ${where}!`, type: 'countdown' };
  });

  /**
   * Hero countdown as a big number + caption (DP2-3 "bold countdown"):
   * `big` is the day count (empty when there's nothing to count down to), and
   * `small` is the caption underneath.
   */
  readonly heroCountdown = computed(() => {
    const trip = this.activeTrip();
    const now  = new Date(this.now());
    if (!trip)                            return { big: '', small: 'No active trip — pick one in My Trips' };
    if (!trip.startDate || !trip.endDate) return { big: '', small: 'Trip dates not set yet' };

    const where = this.destinationShort() || 'your trip';
    const start = new Date(trip.startDate + 'T00:00:00');
    const end   = new Date(trip.endDate   + 'T00:00:00');
    const diff  = start.getTime() - now.getTime();

    if (diff <= 0) {
      const remaining = end.getTime() - now.getTime();
      if (remaining > 0) {
        const d = Math.ceil(remaining / 86_400_000);
        return { big: String(d), small: `day${d !== 1 ? 's' : ''} left in ${where} 🌿` };
      }
      return { big: '', small: `${trip.name} complete 🌿` };
    }

    const days  = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    return { big: String(days), small: `days ${hours}h until ${where}` };
  });

  ngOnInit(): void {
    this.countdownTimer = setInterval(() => this.now.set(Date.now()), 60_000);
  }

  ngOnDestroy(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

}
