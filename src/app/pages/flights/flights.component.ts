import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { DataService } from '../../services/data.service';
import { UserService } from '../../services/user.service';

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
  groupName: string;
  section: string;     // 'ARRIVALS' | 'DEPARTURES'
  stops: Stop[];
  segments: Segment[];
  notes: string[];
  isMyJourney: boolean;
}

type SectionFilter = 'All' | 'ARRIVALS' | 'DEPARTURES';

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-flights',
  imports: [CommonModule, NgTemplateOutlet],
  templateUrl: './flights.component.html',
  styleUrl: './flights.component.scss'
})
export class FlightsComponent {
  dataService = inject(DataService);
  userService = inject(UserService);

  currentUser  = this.userService.currentUser;
  sectionFilter = signal<SectionFilter>('All');
  showMineOnly  = signal(false);

  // ── Build journey view models from flat flight rows ─────────────────────────

  allJourneys = computed((): Journey[] => {
    const flights = this.dataService.data()?.flights ?? [];
    const result: Journey[] = [];
    let current: Journey | null = null;

    for (const f of flights) {
      const startNew = !current
        || f.person  !== current.groupName
        || f.section !== current.section;

      if (startNew) {
        current = {
          groupName:   f.person,
          section:     f.section,
          stops: [
            { iata: f.from, departureTime: f.departureTime, departureDate: f.departureDate },
            { iata: f.to,   arrivalTime:   f.arrivalTime,   arrivalDate:   f.arrivalDate   }
          ],
          segments:    [{ carrier: f.airline, flightNumber: f.flightNumber }],
          notes:       f.notes ? [f.notes] : [],
          isMyJourney: this.nameInGroup(f.person)
        };
        result.push(current);
      } else {
        // Continuation leg — the last stop becomes a layover
        const c = current!;
        const layover = c.stops[c.stops.length - 1];
        layover.departureTime = f.departureTime;
        layover.departureDate = f.departureDate;

        c.stops.push({ iata: f.to, arrivalTime: f.arrivalTime, arrivalDate: f.arrivalDate });
        c.segments.push({ carrier: f.airline, flightNumber: f.flightNumber });
        if (f.notes) c.notes.push(f.notes);
      }
    }

    return result;
  });

  // ── Filtered journeys ────────────────────────────────────────────────────────

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

  // ── Helpers ──────────────────────────────────────────────────────────────────

  nameInGroup(groupName: string): boolean {
    const me = this.currentUser()?.name?.toLowerCase() ?? '';
    return !!me && groupName.toLowerCase().includes(me);
  }

  groupIcon(groupName: string): string {
    const parts = groupName.split(/[&/,]+/).filter(p => p.trim().length > 0);
    if (parts.length >= 3) return '👥';
    if (parts.length === 2) return '👫';
    return '🧳';
  }

  formatShortDate(d: string): string {
    if (!d) return '';
    try {
      const dt = new Date(d + 'T00:00');
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return d; }
  }

  setSectionFilter(f: SectionFilter): void { this.sectionFilter.set(f); }
  toggleMineOnly(): void { this.showMineOnly.set(!this.showMineOnly()); }
  refresh(): void { this.dataService.refresh(); }
}
