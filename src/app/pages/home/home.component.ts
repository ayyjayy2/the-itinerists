import { Component, OnInit, OnDestroy, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  imports: [CommonModule, RouterLink],
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

  private readonly baseLinks: QuickLink[] = [
    { path: '/flights',        label: 'Flights',      icon: '✈️',  description: 'Arrivals & departures', color: '#B5D5F5' },
    { path: '/itinerary',      label: 'Itinerary',    icon: '📅',  description: 'Day-by-day plans',      color: '#F9E4B7' },
    { path: '/accommodations', label: 'Stays',        icon: '🏨',  description: 'Hotels & check-in',     color: '#D4B5F5' },
    { path: '/finance',        label: 'Finance',      icon: '💵',  description: 'Shared expenses',       color: '#88C9A1' },
    { path: '/recs',           label: 'Recs',         icon: '🌸',  description: 'Local tips & spots',    color: '#B5F5D4' },
    { path: '/packing',        label: 'Packing',      icon: '🧳',  description: 'Your packing list',     color: '#F9E4B7' },
    { path: '/outfits',        label: 'Outfits',      icon: '👗',  description: 'Plan your looks',       color: '#F5B5D4' },
    { path: '/profile',        label: 'Profile',      icon: '👤',  description: 'Settings & account',    color: '#F5D4B5' },
  ];

  readonly quickLinks = computed(() => {
    // Respect the member's hidden pages for the active trip (TP-15).
    const hidden = this.tripService.hiddenPages();
    const links = this.baseLinks.filter(l => !hidden.includes(l.path.slice(1)));
    return this.isAdmin()
      ? [...links, { path: '/admin', label: 'Admin', icon: '⚙️', description: 'Trip & members', color: '#D4B5F5' }]
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

  ngOnInit(): void {
    this.countdownTimer = setInterval(() => this.now.set(Date.now()), 60_000);
  }

  ngOnDestroy(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

}
