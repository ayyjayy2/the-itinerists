import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TripService, CreateTripInput } from '../../services/trip.service';
import { TripDestination } from '../../models/trip.models';
import { tripSummary } from '../../utils/trip-destinations';
import { IconComponent } from '../../shared/icon/icon.component';
import { CurrencySelectComponent } from '../../shared/currency-select/currency-select.component';

/** One editable destination row in multi-destination mode. */
interface DestForm {
  destination: string;
  startDate: string;
  endDate: string;
  currency: string;
}

@Component({
  selector: 'app-create-trip',
  imports: [IconComponent, CurrencySelectComponent, CommonModule, FormsModule],
  templateUrl: './create-trip.component.html',
  styleUrl: './create-trip.component.scss',
})
export class CreateTripComponent {
  private tripService = inject(TripService);
  private router      = inject(Router);

  name = '';

  // Single-destination mode (default).
  destination = '';
  startDate   = '';
  endDate     = '';
  currency    = 'USD';

  // Multi-destination mode.
  multiDest    = false;
  destinations: DestForm[] = [];

  saving = signal(false);
  error  = signal('');

  private blankLeg(): DestForm {
    return { destination: '', startDate: '', endDate: '', currency: 'USD' };
  }

  toggleMulti(on: boolean): void {
    this.multiDest = on;
    if (on && this.destinations.length === 0) {
      // Seed the first leg from anything already typed in single mode.
      this.destinations = [{
        destination: this.destination,
        startDate: this.startDate,
        endDate: this.endDate,
        currency: this.currency,
      }];
    }
  }

  addDestination(): void {
    this.destinations.push(this.blankLeg());
  }

  removeDestination(index: number): void {
    if (this.destinations.length > 1) this.destinations.splice(index, 1);
  }

  async create(): Promise<void> {
    const name = this.name.trim();
    if (!name) { this.error.set('Please enter a trip name.'); return; }

    let input: CreateTripInput;

    if (this.multiDest) {
      for (let i = 0; i < this.destinations.length; i++) {
        const d = this.destinations[i], n = i + 1;
        if (!d.destination.trim())      { this.error.set(`Destination ${n}: please enter a destination.`); return; }
        if (!d.startDate || !d.endDate) { this.error.set(`Destination ${n}: please choose start and end dates.`); return; }
        if (d.endDate < d.startDate)    { this.error.set(`Destination ${n}: end date can’t be before the start date.`); return; }
      }
      const destinations: TripDestination[] = this.destinations.map(d => ({
        destination: d.destination.trim(),
        startDate: d.startDate,
        endDate: d.endDate,
        currency: d.currency,
      }));
      input = { name, ...tripSummary(destinations), destinations };
    } else {
      const destination = this.destination.trim();
      if (!destination)                     { this.error.set('Please enter a destination.'); return; }
      if (!this.startDate || !this.endDate) { this.error.set('Please choose start and end dates.'); return; }
      if (this.endDate < this.startDate)    { this.error.set('End date can’t be before the start date.'); return; }
      input = { name, destination, startDate: this.startDate, endDate: this.endDate, currency: this.currency };
    }

    this.error.set('');
    this.saving.set(true);
    try {
      await this.tripService.createTrip(input);
      // createTrip sets the new trip active; land on Home.
      this.router.navigate(['/home']);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Could not create the trip. Please try again.');
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/home']);
  }
}
