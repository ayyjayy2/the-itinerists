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

// ── Form types ────────────────────────────────────────────────────────────────

interface LegForm {
  id?: string;       // present for existing legs
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

interface FlightForm {
  section: 'ARRIVALS' | 'DEPARTURES';
  assignedUid: string;
  legs: LegForm[];
}

type SectionFilter = 'All' | 'ARRIVALS' | 'DEPARTURES';

function emptyLeg(): LegForm {
  return { from: '', to: '', airline: '', flightNumber: '',
           departureDate: '', departureTime: '', arrivalDate: '', arrivalTime: '', notes: '' };
}

function emptyForm(): FlightForm {
  return { section: 'ARRIVALS', assignedUid: '', legs: [emptyLeg()] };
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

  // ── Add modal ────────────────────────────────────────────────────────────────
  showAddModal = signal(false);
  addForm      = emptyForm();
  addSaving    = signal(false);
  addError     = signal('');

  openAddModal(): void {
    this.addForm = { ...emptyForm(), assignedUid: this.currentUser()?.uid ?? '' };
    this.addError.set('');
    this.showAddModal.set(true);
  }
  closeAddModal(): void { this.showAddModal.set(false); }

  addLayoverToAdd(): void { this.addForm.legs.push(emptyLeg()); }
  removeLegFromAdd(i: number): void { this.addForm.legs.splice(i, 1); }

  async saveAdd(): Promise<void> {
    if (!this.validateForm(this.addForm)) return;
    this.addSaving.set(true);
    this.addError.set('');
    try {
      const base = {
        uid:        this.addForm.assignedUid,
        addedByUid: this.currentUser()!.uid!,
        section:    this.addForm.section,
        createdAt:  Date.now(),
      };
      for (const leg of this.addForm.legs) {
        await this.flightsService.addFlight({ ...base, ...this.normalizeLeg(leg) });
      }
      this.closeAddModal();
    } catch {
      this.addError.set('Failed to save. Please try again.');
    } finally {
      this.addSaving.set(false);
    }
  }

  // ── Edit modal ────────────────────────────────────────────────────────────────
  showEditModal  = signal(false);
  editForm       = emptyForm();
  editOriginalIds: string[] = [];
  editSaving     = signal(false);
  editError      = signal('');

  openEditModal(journey: Journey): void {
    const allFlights = this.flightsService.flights();
    // Gather the actual FlightDoc legs in departure-date order
    const legs = journey.legIds
      .map(id => allFlights.find(f => f.id === id))
      .filter((f): f is FlightDoc => !!f)
      .sort((a, b) => a.departureDate.localeCompare(b.departureDate) || a.departureTime.localeCompare(b.departureTime));

    this.editOriginalIds = legs.map(l => l.id);
    this.editForm = {
      section:     journey.section,
      assignedUid: journey.uid,
      legs: legs.map(l => ({
        id:            l.id,
        from:          l.from,
        to:            l.to,
        airline:       l.airline,
        flightNumber:  l.flightNumber,
        departureDate: l.departureDate,
        departureTime: l.departureTime,
        arrivalDate:   l.arrivalDate,
        arrivalTime:   l.arrivalTime,
        notes:         l.notes,
      })),
    };
    this.editError.set('');
    this.showEditModal.set(true);
  }

  closeEditModal(): void { this.showEditModal.set(false); }

  addLayoverToEdit(): void { this.editForm.legs.push(emptyLeg()); }
  removeLegFromEdit(i: number): void { this.editForm.legs.splice(i, 1); }

  async saveEdit(): Promise<void> {
    if (!this.validateForm(this.editForm)) return;
    this.editSaving.set(true);
    this.editError.set('');
    try {
      const base = {
        uid:     this.editForm.assignedUid,
        section: this.editForm.section,
      };
      const currentIds = this.editForm.legs.filter(l => l.id).map(l => l.id!);
      // Delete removed legs
      for (const id of this.editOriginalIds) {
        if (!currentIds.includes(id)) await this.flightsService.deleteFlight(id);
      }
      for (const leg of this.editForm.legs) {
        if (leg.id) {
          await this.flightsService.updateFlight(leg.id, { ...base, ...this.normalizeLeg(leg) });
        } else {
          await this.flightsService.addFlight({ ...base, addedByUid: this.currentUser()!.uid!, createdAt: Date.now(), ...this.normalizeLeg(leg) });
        }
      }
      this.closeEditModal();
    } catch {
      this.editError.set('Failed to save. Please try again.');
    } finally {
      this.editSaving.set(false);
    }
  }

  async deleteJourney(): Promise<void> {
    this.editSaving.set(true);
    try {
      await Promise.all(this.editOriginalIds.map(id => this.flightsService.deleteFlight(id)));
      this.closeEditModal();
    } finally {
      this.editSaving.set(false);
    }
  }

  // ── Shared helpers ────────────────────────────────────────────────────────────

  private validateForm(form: FlightForm): boolean {
    if (!form.assignedUid) { this.setFormError(form, 'Please select a traveller.'); return false; }
    for (const leg of form.legs) {
      if (!leg.from.trim() || !leg.to.trim() || !leg.departureDate || !leg.departureTime || !leg.arrivalDate || !leg.arrivalTime) {
        this.setFormError(form, 'Please fill in all required fields for each leg.');
        return false;
      }
    }
    return true;
  }

  private setFormError(form: FlightForm, msg: string): void {
    if (form === this.addForm) this.addError.set(msg);
    else this.editError.set(msg);
  }

  private normalizeLeg(leg: LegForm) {
    return {
      from:          leg.from.trim().toUpperCase(),
      to:            leg.to.trim().toUpperCase(),
      airline:       leg.airline.trim(),
      flightNumber:  leg.flightNumber.trim(),
      departureDate: leg.departureDate,
      departureTime: leg.departureTime.trim(),
      arrivalDate:   leg.arrivalDate,
      arrivalTime:   leg.arrivalTime.trim(),
      notes:         leg.notes.trim(),
    };
  }

  // ── Build journey view models ─────────────────────────────────────────────────

  allJourneys = computed((): Journey[] => {
    const flights = this.flightsService.flights();
    const users   = this.usersService.allUsers();
    const myUid   = this.currentUser()?.uid ?? '';

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
            { iata: f.to,   arrivalTime: f.arrivalTime,     arrivalDate: f.arrivalDate   },
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
    return this.allJourneys().filter(j =>
      (section === 'All' || j.section === section) && (!mineOnly || j.isMyJourney)
    );
  });

  arrivals   = computed(() => this.filteredJourneys().filter(j => j.section === 'ARRIVALS'));
  departures = computed(() => this.filteredJourneys().filter(j => j.section === 'DEPARTURES'));

  readonly destination = computed(() =>
    this.tripConfigService.config()?.locationLabel ?? 'Savannah'
  );

  formatShortDate(d: string): string {
    if (!d) return '';
    try { return new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return d; }
  }

  setSectionFilter(f: SectionFilter): void { this.sectionFilter.set(f); }
}
