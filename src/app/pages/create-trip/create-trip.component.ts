import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TripService, CreateTripInput } from '../../services/trip.service';

interface CurrencyOption { code: string; label: string; }

@Component({
  selector: 'app-create-trip',
  imports: [CommonModule, FormsModule],
  templateUrl: './create-trip.component.html',
  styleUrl: './create-trip.component.scss',
})
export class CreateTripComponent {
  private tripService = inject(TripService);
  private router      = inject(Router);

  name        = '';
  destination = '';
  startDate   = '';
  endDate     = '';
  currency    = 'USD';

  readonly currencies: CurrencyOption[] = [
    { code: 'USD', label: 'USD — US Dollar' },
    { code: 'EUR', label: 'EUR — Euro' },
    { code: 'GBP', label: 'GBP — British Pound' },
    { code: 'CAD', label: 'CAD — Canadian Dollar' },
    { code: 'AUD', label: 'AUD — Australian Dollar' },
    { code: 'JPY', label: 'JPY — Japanese Yen' },
    { code: 'MXN', label: 'MXN — Mexican Peso' },
  ];

  saving = signal(false);
  error  = signal('');

  async create(): Promise<void> {
    const name = this.name.trim();
    const destination = this.destination.trim();
    if (!name)                            { this.error.set('Please enter a trip name.'); return; }
    if (!destination)                     { this.error.set('Please enter a destination.'); return; }
    if (!this.startDate || !this.endDate) { this.error.set('Please choose start and end dates.'); return; }
    if (this.endDate < this.startDate)    { this.error.set('End date can’t be before the start date.'); return; }

    this.error.set('');
    this.saving.set(true);
    try {
      const input: CreateTripInput = {
        name,
        destination,
        startDate: this.startDate,
        endDate: this.endDate,
        currency: this.currency,
      };
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
