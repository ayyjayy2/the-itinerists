import { Component, OnInit, OnDestroy, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';
import { DataService } from '../../services/data.service';
import { FlightCountdownService } from '../../services/flight-countdown.service';

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
  dataService     = inject(DataService);
  flightCountdown = inject(FlightCountdownService);

  currentUser = this.userService.currentUser;

  flightCountdownLabel = signal('');
  private now = signal(Date.now());
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  readonly quickLinks: QuickLink[] = [
    { path: '/flights',        label: 'Flights',      icon: '✈️', description: 'Arrivals & departures', color: '#B5D5F5' },
    { path: '/itinerary',      label: 'Itinerary',    icon: '📅', description: 'Day-by-day plans',      color: '#F9E4B7' },
    { path: '/accommodations', label: 'Stays',        icon: '🏨', description: 'Hotels & check-in',     color: '#D4B5F5' },
    { path: '/finance',        label: 'Finance',      icon: '💶', description: 'Shared expenses',       color: '#88C9A1' },
    { path: '/expenses',       label: 'My Expenses',  icon: '🧾', description: 'Personal log',          color: '#F4C2C2' },
    { path: '/recs',           label: 'Recs',         icon: '☘️', description: 'Irish tips & words',    color: '#B5F5D4' },
    { path: '/rental-car',     label: 'Rental Car',   icon: '🚗', description: 'Car rental info',       color: '#F5D4B5' },
    { path: '/packing',        label: 'Packing',      icon: '🧳', description: 'Your packing list',     color: '#F9E4B7' },
    { path: '/outfits',        label: 'Outfits',      icon: '👗', description: 'Plan your looks',        color: '#F5B5D4' },
    { path: '/map',            label: 'Map',          icon: '🗺️', description: 'Interactive trip map',   color: '#B5E8D5' },
  ];

  ngOnInit(): void {
    this.updateCountdowns();
    this.countdownTimer = setInterval(() => this.updateCountdowns(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

  private updateCountdowns(): void {
    this.now.set(Date.now());
    const name    = this.currentUser()?.name ?? '';
    const flights = this.dataService.data()?.flights ?? [];
    this.flightCountdownLabel.set(this.flightCountdown.getCountdown(name, flights));
  }

  // Trip dates — update these to your actual trip
  readonly tripStart = new Date('2026-03-12');
  readonly tripEnd   = new Date('2026-03-23');

  countdown = computed(() => {
    const now = new Date(this.now());
    const diff = this.tripStart.getTime() - now.getTime();
    if (diff <= 0) {
      const tripDiff = this.tripEnd.getTime() - now.getTime();
      if (tripDiff > 0) {
        const days = Math.ceil(tripDiff / (1000 * 60 * 60 * 24));
        return { label: `Trip is live! ${days} day${days !== 1 ? 's' : ''} left`, type: 'live' };
      }
      return { label: 'Ireland trip completed! 🍀', type: 'done' };
    }
    const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return { label: `${days}d ${hours}h until takeoff!`, type: 'countdown' };
  });

  isLoading = this.dataService.loading;
  isStale   = this.dataService.isStale;

  refresh(): void {
    this.dataService.refresh();
  }
}
