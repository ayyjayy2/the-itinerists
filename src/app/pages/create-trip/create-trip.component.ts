import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TripService, CreateTripInput } from '../../services/trip.service';
import { CURRENCIES } from '../../data/currencies';

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

  // ── Currency combobox (type to filter all ISO 4217 currencies) ─────────────
  readonly currencies = CURRENCIES;
  currencyOpen  = signal(false);
  currencyQuery = signal('');
  activeIndex   = signal(0);

  /** The full list when closed/empty, otherwise filtered by code or name. */
  readonly filteredCurrencies = computed(() => {
    const q = this.currencyQuery().trim().toLowerCase();
    if (!q) return this.currencies;
    return this.currencies.filter(c =>
      c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  });

  /**
   * Label shown in the input when a currency is selected and not being edited.
   * A method (not a computed) because `currency` is a plain field, not a signal —
   * a computed would cache the initial value and never reflect later selections.
   */
  selectedCurrencyLabel(): string {
    const c = this.currencies.find(x => x.code === this.currency);
    return c ? `${c.code} — ${c.name}` : this.currency;
  }

  saving = signal(false);
  error  = signal('');

  openCurrency(): void {
    this.currencyQuery.set('');
    this.activeIndex.set(0);
    this.currencyOpen.set(true);
  }

  onCurrencyInput(value: string): void {
    this.currencyQuery.set(value);
    this.activeIndex.set(0);
    this.currencyOpen.set(true);
  }

  selectCurrency(code: string): void {
    this.currency = code;
    this.currencyQuery.set('');
    this.currencyOpen.set(false);
  }

  closeCurrency(): void {
    this.currencyOpen.set(false);
  }

  onCurrencyKeydown(event: KeyboardEvent): void {
    if (!this.currencyOpen() && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      this.openCurrency();
      return;
    }
    const list = this.filteredCurrencies();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.set(Math.min(this.activeIndex() + 1, list.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        const choice = list[this.activeIndex()];
        if (choice) this.selectCurrency(choice.code);
        break;
      }
      case 'Escape':
        this.closeCurrency();
        break;
    }
  }

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
