import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TripService } from '../../services/trip.service';
import { TripContextService } from '../../services/trip-context.service';
import { UserService } from '../../services/user.service';
import { TripDoc } from '../../models/trip.models';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

@Component({
  selector: 'app-my-trips',
  imports: [CommonModule],
  templateUrl: './my-trips.component.html',
  styleUrl: './my-trips.component.scss',
})
export class MyTripsComponent implements OnInit {
  private tripService = inject(TripService);
  private userService = inject(UserService);
  private router      = inject(Router);
  private tripContext = inject(TripContextService);

  trips   = signal<TripDoc[]>([]);
  loading = signal(true);
  error   = signal('');

  async ngOnInit(): Promise<void> {
    const user = this.userService.firestoreUser();
    if (!user) { this.loading.set(false); return; }
    try {
      const trips = await this.tripService.getUserTrips(user.uid);
      trips.sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
      this.trips.set(trips);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Could not load your trips.');
    } finally {
      this.loading.set(false);
    }
  }

  isActive(trip: TripDoc): boolean {
    return this.tripContext.activeTripId() === trip.id;
  }

  async open(trip: TripDoc): Promise<void> {
    await this.tripService.switchTrip(trip.id);
    this.router.navigate(['/home']);
  }

  newTrip(): void {
    this.router.navigate(['/trips/new']);
  }

  dateRange(t: TripDoc): string {
    return `${fmtDate(t.startDate)} – ${fmtDate(t.endDate)}`;
  }
}

/** "2026-10-01" → "Oct 1, 2026" */
function fmtDate(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return d;
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}
