import { Component, OnInit, OnDestroy, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';
import { DataService } from '../../services/data.service';
import { FlightCountdownService } from '../../services/flight-countdown.service';
import { FlightsService } from '../../services/flights.service';
import { TripConfigService } from '../../services/trip-config.service';

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
  userService       = inject(UserService);
  dataService       = inject(DataService);
  flightCountdown   = inject(FlightCountdownService);
  flightsService    = inject(FlightsService);
  tripConfigService = inject(TripConfigService);

  currentUser = this.userService.currentUser;
  isAdmin     = this.userService.isAdmin;

  private now = signal(Date.now());
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  private readonly baseLinks: QuickLink[] = [
    { path: '/flights',        label: 'Flights',      icon: '✈️',  description: 'Arrivals & departures', color: '#B5D5F5' },
    { path: '/itinerary',      label: 'Itinerary',    icon: '📅',  description: 'Day-by-day plans',      color: '#F9E4B7' },
    { path: '/accommodations', label: 'Stays',        icon: '🏨',  description: 'Hotels & check-in',     color: '#D4B5F5' },
    { path: '/finance',        label: 'Finance',      icon: '💵',  description: 'Shared expenses',       color: '#88C9A1' },
    { path: '/recs',           label: 'Recs',         icon: '🌸',  description: 'Savannah tips & spots', color: '#B5F5D4' },
    { path: '/packing',        label: 'Packing',      icon: '🧳',  description: 'Your packing list',     color: '#F9E4B7' },
    { path: '/outfits',        label: 'Outfits',      icon: '👗',  description: 'Plan your looks',       color: '#F5B5D4' },
    { path: '/profile',        label: 'Profile',      icon: '👤',  description: 'Settings & account',    color: '#F5D4B5' },
  ];

  readonly quickLinks = computed(() => this.isAdmin()
    ? [...this.baseLinks, { path: '/admin', label: 'Admin', icon: '⚙️', description: 'Trip & members', color: '#D4B5F5' }]
    : this.baseLinks
  );

  readonly flightLabel = computed(() => {
    const uid     = this.currentUser()?.uid ?? '';
    const flights = this.flightsService.flights();
    this.now(); // subscribe to timer ticks
    return this.flightCountdown.getCountdownForUid(uid, flights);
  });

  readonly countdown = computed(() => {
    const cfg = this.tripConfigService.config();
    const now = new Date(this.now());

    if (!cfg?.startDate || !cfg?.endDate) {
      return { label: 'Trip dates not set yet', type: 'unset' };
    }

    const tripStart = new Date(cfg.startDate + 'T00:00:00');
    const tripEnd   = new Date(cfg.endDate   + 'T00:00:00');
    const diff      = tripStart.getTime() - now.getTime();

    if (diff <= 0) {
      const remaining = tripEnd.getTime() - now.getTime();
      if (remaining > 0) {
        const days = Math.ceil(remaining / (1000 * 60 * 60 * 24));
        return { label: `Trip is live! ${days} day${days !== 1 ? 's' : ''} left 🌿`, type: 'live' };
      }
      return { label: 'Savannah getaway complete! 🌿', type: 'done' };
    }

    const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return { label: `${days}d ${hours}h until Savannah!`, type: 'countdown' };
  });

  readonly locationLabel = computed(() => {
    const cfg = this.tripConfigService.config();
    return cfg?.locationLabel ?? 'Savannah, Georgia';
  });

  ngOnInit(): void {
    this.countdownTimer = setInterval(() => this.now.set(Date.now()), 60_000);
  }

  ngOnDestroy(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

  isLoading = this.dataService.loading;
  isStale   = this.dataService.isStale;

  refresh(): void {
    this.dataService.refresh();
  }
}
