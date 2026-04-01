import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FlightsService } from '../../services/flights.service';
import { UsersService } from '../../services/users.service';
import { UserService } from '../../services/user.service';
import { TripConfigService } from '../../services/trip-config.service';
import { FlightDoc } from '../../models/trip.models';

// ── View models ───────────────────────────────────────────────────────────────

interface Stop {
  iata: string;
  departureTime?: string;
  departureDate?: string;
  arrivalTime?: string;
  arrivalDate?: string;
}

interface Segment {
  carrier: string;
  flightNumber: string;
}

interface Journey {
  uid: string;
  groupName: string;
  section: 'ARRIVALS' | 'DEPARTURES';
  stops: Stop[];
  segments: Segment[];
  notes: string[];
  isMyJourney: boolean;
  legIds: string[];
}

interface FlightForm {
  section: 'ARRIVALS' | 'DEPARTURES';
  assignedUid: string;
  from: string;
  to: string;
  airline: string;
  flightNumber: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  notes: string;
}

type SectionFilter = 'All' | 'ARRIVALS' | 'DEPARTURES';

function emptyForm(): FlightForm {
  return {
    section: 'ARRIVALS', assignedUid: '',
    from: '', to: '', airline: '', flightNumber: '',
    departureDate: '', departureTime: '', arrivalDate: '', arrivalTime: '',
    notes: '',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-flights',
  imports: [CommonModule, NgTemplateOutlet, FormsModule],
  templateUrl: './flights.component.html',
  styleUrl: './flights.component.scss'
})
export class FlightsComponent {
  flightsService    = inject(FlightsService);
  usersService      = inject(UsersService);
  userService       = inject(UserService);
  tripConfigService = inject(TripConfigService);

  currentUser   = this.userService.currentUser;
  tripUsers     = this.usersService.tripUsers;
  sectionFilter = signal<SectionFilter>('All');
  showMineOnly  = signal(false);

  // ── Add-flight modal ───────────────────────────────────────────��────────────
  showAddModal = signal(false);
  form         = emptyForm();
  saving       = signal(false);
  formError    = signal('');

  openAddModal(): void {
    this.form      = { ...emptyForm(), assignedUid: this.currentUser()?.uid ?? '' };
    this.formError.set('');
    this.showAddModal.set(true);
  }

  closeAddModal(): void { this.showAddModal.set(false); }

  async saveFlight(): Promise<void> {
    const f = this.form;
    if (!f.assignedUid || !f.from.trim() || !f.to.trim() || !f.departureDate || !f.departureTime || !f.arrivalDate || !f.arrivalTime) {
      this.formError.set('Please fill in all required fields.');
      return;
    }
    this.saving.set(true);
    this.formError.set('');
    try {
      await this.flightsService.addFlight({
        uid:           f.assignedUid,
        addedByUid:    this.currentUser()!.uid!,
        section:       f.section,
        airline:       f.airline.trim(),
        flightNumber:  f.flightNumber.trim(),
        from:          f.from.trim().toUpperCase(),
        to:            f.to.trim().toUpperCase(),
        departureDate: f.departureDate,
        departureTime: f.departureTime.trim(),
        arrivalDate:   f.arrivalDate,
        arrivalTime:   f.arrivalTime.trim(),
        notes:         f.notes.trim(),
        createdAt:     Date.now(),
      });
      this.closeAddModal();
    } catch {
      this.formError.set('Failed to save flight. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async deleteJourney(legIds: string[]): Promise<void> {
    await Promise.all(legIds.map(id => this.flightsService.deleteFlight(id)));
  }

  // ── Build journey view models ────────────────────────────────────────────────

  allJourneys = computed((): Journey[] => {
    const flights = this.flightsService.flights();
    const users   = this.usersService.allUsers();
    const myUid   = this.currentUser()?.uid ?? '';

    // Sort: by uid, section, departure date/time
    const sorted = [...flights].sort((a, b) =>
      a.uid.localeCompare(b.uid) ||
      a.section.localeCompare(b.section) ||
      a.departureDate.localeCompare(b.departureDate) ||
      a.departureTime.localeCompare(b.departureTime)
    );

    const result: Journey[] = [];
    let current: Journey | null = null;

    for (const f of sorted) {
      const startNew = !current || f.uid !== current.uid || f.section !== current.section;

      if (startNew) {
        const user = users.find(u => u.uid === f.uid);
        current = {
          uid:         f.uid,
          groupName:   user?.displayName ?? 'Unknown',
          section:     f.section,
          stops: [
            { iata: f.from, departureTime: f.departureTime, departureDate: f.departureDate },
            { iata: f.to,   arrivalTime:   f.arrivalTime,   arrivalDate:   f.arrivalDate   }
          ],
          segments:    [{ carrier: f.airline, flightNumber: f.flightNumber }],
          notes:       f.notes ? [f.notes] : [],
          isMyJourney: f.uid === myUid,
          legIds:      [f.id],
        };
        result.push(current);
      } else {
        const c = current!;
        const layover = c.stops[c.stops.length - 1];
        layover.departureTime = f.departureTime;
        layover.departureDate = f.departureDate;
        c.stops.push({ iata: f.to, arrivalTime: f.arrivalTime, arrivalDate: f.arrivalDate });
        c.segments.push({ carrier: f.airline, flightNumber: f.flightNumber });
        if (f.notes) c.notes.push(f.notes);
        c.legIds.push(f.id);
      }
    }

    return result;
  });

  filteredJourneys = computed(() => {
    const section  = this.sectionFilter();
    const mineOnly = this.showMineOnly();
    return this.allJourneys().filter(j => {
      const sectionOk = section === 'All' || j.section === section;
      const personOk  = !mineOnly || j.isMyJourney;
      return sectionOk && personOk;
    });
  });

  arrivals   = computed(() => this.filteredJourneys().filter(j => j.section === 'ARRIVALS'));
  departures = computed(() => this.filteredJourneys().filter(j => j.section === 'DEPARTURES'));

  readonly destination = computed(() =>
    this.tripConfigService.config()?.locationLabel ?? 'Savannah'
  );

  // ── Helpers ──────────────────────────────────────────────────────────────────

  formatShortDate(d: string): string {
    if (!d) return '';
    try {
      return new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return d; }
  }

  setSectionFilter(f: SectionFilter): void { this.sectionFilter.set(f); }
  toggleMineOnly(): void { this.showMineOnly.set(!this.showMineOnly()); }
}
