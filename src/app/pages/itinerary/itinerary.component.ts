import { isOutsideTripDates } from '../../utils/trip-destinations';
import { stopDateRange } from '../../utils/stop-dates';
import { CalendarExportService, CalendarExportResult } from '../../services/calendar-export.service';
import { Component, OnInit, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { RouterLink } from '@angular/router';
import { ItineraryService } from '../../services/itinerary.service';
import { UserService } from '../../services/user.service';
import { UsersService } from '../../services/users.service';
import { FlightsService } from '../../services/flights.service';
import { TripService } from '../../services/trip.service';
import { DataService } from '../../services/data.service';
import { ItineraryItemDoc } from '../../models/trip.models';
import { IconComponent } from '../../shared/icon/icon.component';
import { LoadingComponent } from '../../shared/loading/loading.component';
import { NoTripStateComponent } from '../../shared/no-trip-state/no-trip-state.component';
import { flightMomentsForUid, mirroredFlightMoment } from '../../utils/flight-events';
import { AirportZoneService } from '../../services/airport-zone.service';
import { zoneAbbr } from '../../utils/zones';
import { parseTimeString } from '../../utils/first-up';
import { wallToUtcMs } from '../../utils/zones';
import { stayMomentsFor } from '../../utils/stay-events';
import { TimeInputComponent } from '../../shared/time-input/time-input.component';
import { Time12Pipe } from '../../shared/time12.pipe';

type ViewMode = 'list' | 'calendar';

const CATEGORIES = [
  'Food', 'Drink', 'Sightseeing', 'Culture',
  'Transport', 'Accommodation', 'Activity', 'Free',
];

/** Inclusive YYYY-MM-DD range builder. */
function dateRange(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(start + 'T00:00');
  const end_ = new Date(end + 'T00:00');
  while (cur <= end_) { days.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }
  return days;
}

/** Fallback when a trip has no dates yet: today + the next 6 days, so the plan stays usable. */
function fallbackWindow(): string[] {
  const days: string[] = [];
  const cur = new Date(); cur.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) { days.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }
  return days;
}

import { FocusTargetDirective } from '../../shared/focus-target.directive';
import { FocusService, focusDate } from '../../services/focus.service';
@Component({
  selector: 'app-itinerary',
  imports: [FocusTargetDirective, LoadingComponent, IconComponent, NoTripStateComponent, CommonModule, FormsModule, DragDropModule, RouterLink, TimeInputComponent, Time12Pipe],
  templateUrl: './itinerary.component.html',
  styleUrl: './itinerary.component.scss'
})
export class ItineraryComponent implements OnInit {
  itineraryService  = inject(ItineraryService);
  userService       = inject(UserService);
  usersService      = inject(UsersService);
  flightsService    = inject(FlightsService);
  private airportZones = inject(AirportZoneService);
  tripService       = inject(TripService);
  dataService       = inject(DataService);
  private focus     = inject(FocusService);

  view         = signal<ViewMode>('list');
  selectedDate = signal<string>('All');
  currentUser  = this.userService.currentUser;
  showAll      = signal<boolean>(false);
  isAdmin      = this.userService.isAdmin;

  /** Active-trip date state (TP-23). */
  readonly hasActiveTrip = computed(() => this.tripService.activeTrip() !== null);
  /** Spinner (delayed) until we know the trip and its data — no empty-state flash. */
  readonly loading = computed(() => !this.tripService.ready() || !this.itineraryService.loaded() || !this.flightsService.loaded());
  readonly hasTripDates  = computed(() => {
    const t = this.tripService.activeTrip();
    return !!(t?.startDate && t?.endDate);
  });

  readonly categories = CATEGORIES;

  // ── Day label editing ──────────────────────────────────────────────────────
  editingLabelDate = signal<string | null>(null);
  draftLabel       = '';

  startLabelEdit(date: string): void {
    this.draftLabel = this.effectiveDayLabel(date);
    this.editingLabelDate.set(date);
  }

  saveLabelEdit(date: string): void {
    const uid = this.currentUser()?.uid;
    if (!uid) return;
    const label = this.draftLabel.trim();
    if (label) this.itineraryService.saveDayLabel(uid, date, label);
    this.editingLabelDate.set(null);
  }

  cancelLabelEdit(): void { this.editingLabelDate.set(null); }

  // ── Edit item state ────────────────────────────────────────────────────────
  editingId     = signal<string | null>(null);
  draft: Partial<ItineraryItemDoc> = {};
  editForWhoMap: Record<string, boolean> = {};

  // ── Add item state ─────────────────────────────────────────────────────────
  addingToDate = signal<string | null>(null);
  newDraft: Partial<ItineraryItemDoc> = {};
  addForWhoMap: Record<string, boolean> = {};

  // ── Trip days from the active trip ──────────────────────────────────────────
  readonly tripDays = computed((): string[] => {
    const t = this.tripService.activeTrip();
    if (t?.startDate && t?.endDate) return dateRange(t.startDate, t.endDate);
    // A trip with no dates yet still gets usable day cards (TP-23); no trip → empty.
    return t ? fallbackWindow() : [];
  });

  effectiveDayLabel(date: string): string {
    const custom = this.itineraryService.dayLabels()[date];
    if (custom) return custom;
    const startStr = this.tripService.activeTrip()?.startDate;
    if (!startStr) return date;
    // A day outside the trip has no day number ("Day -107"): show its date instead.
    if (isOutsideTripDates(date, this.tripService.activeTrip())) return stopDateRange(date, date);
    const start = new Date(startStr + 'T00:00');
    const d     = new Date(date + 'T00:00');
    const diff  = Math.round((d.getTime() - start.getTime()) / 86_400_000);
    return `Day ${diff + 1}`;
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  readonly allItems = computed(() =>
    [...this.itineraryService.items()].sort((a, b) =>
      a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder || a.time.localeCompare(b.time)
    )
  );

  /** Every depart / arrive moment of the current user's flights, each in its airport's zone. */
  private readonly flightMoments = computed(() => {
    const uid  = this.currentUser()?.uid ?? '';
    const dest = this.tripService.activeTrip()?.destination ?? 'your destination';
    const zones = this.airportZones.zones();   // read so this re-runs when the table lands
    return flightMomentsForUid(this.flightsService.flights(), uid, dest, iata => zones[iata?.toUpperCase()] ?? this.airportZones.zoneFor(iata));
  });

  /**
   * What a hand-typed item should show for its time. One that stands for a
   * real flight (Transport, or titled like flying, on a day with a flight)
   * shows the Flights page's time in the airport's zone, never the typed one.
   */
  flightTimeFor(item: ItineraryItemDoc): { time: string; zoneLabel: string } | null {
    const m = mirroredFlightMoment(item, this.flightMoments());
    if (!m) return null;
    const t = parseTimeString(m.time);
    const zoneLabel = m.zone ? zoneAbbr(m.zone, t ? wallToUtcMs(m.date, t.h, t.min, m.zone) : Date.now()) : '';
    return { time: m.time, zoneLabel };
  }

  /** Auto-generated flight events for the current user — not stored, not editable.
   *  Arrivals show the landing moment; departures show the leaving moment. */
  readonly flightEvents = computed(() => {
    return this.flightMoments()
      .filter(m => m.kind === (m.section === 'ARRIVALS' ? 'arrive' : 'depart'))
      .map(({ date, label, time, zone }) => {
        // A flight time always says its airport's zone (CEST, CDT), as on the Flights page.
        const t = parseTimeString(time);
        const zoneLabel = zone ? zoneAbbr(zone, t ? wallToUtcMs(date, t.h, t.min, zone) : Date.now()) : '';
        return { date, label, time, zoneLabel };
      });
  });

  /** Auto-generated check-in / check-out events from the Stays page for the current user — not editable here. */
  readonly stayEvents = computed(() => {
    const me    = this.currentUser()?.name ?? '';
    const stays = this.dataService.data()?.accommodations ?? [];
    return stayMomentsFor(stays, me);
  });

  stayEventsForDate(date: string) {
    return this.stayEvents().filter(e => e.date === date);
  }

  /** Auto-generated transportation events (pick-up/drop-off or depart/arrive) — not editable here. */
  readonly transportEvents = computed(() => {
    const cars = this.dataService.data()?.rentalCar ?? [];
    const events: Array<{ date: string; label: string; time: string; icon: string }> = [];
    for (const c of cars) {
      if (!c.company) continue;
      const icon = this.transportIcon(c.mode);
      const isVehicle = !c.mode || c.mode === 'Rental Car' || c.mode === 'Rideshare';
      if (c.pickupDate) {
        events.push({
          date: c.pickupDate, time: c.pickupTime, icon,
          label: `${isVehicle ? 'Pick up' : 'Depart'}: ${c.company}${c.pickupLocation ? ' – ' + c.pickupLocation : ''}`,
        });
      }
      if (c.dropoffDate) {
        events.push({
          date: c.dropoffDate, time: c.dropoffTime, icon,
          label: `${isVehicle ? 'Drop off' : 'Arrive'}: ${c.company}${c.dropoffLocation ? ' – ' + c.dropoffLocation : ''}`,
        });
      }
    }
    return events;
  });

  private transportIcon(mode?: string): string {
    switch (mode) {
      case 'Train': return 'train';
      case 'Bus':   return 'bus';
      case 'Ferry': return 'boat';
      default:      return 'car';
    }
  }

  transportEventsForDate(date: string) {
    return this.transportEvents().filter(e => e.date === date);
  }

  readonly tripUsers = this.usersService.tripUsers;

  // ── Items outside the trip's dates ────────────────────────────────────────
  readonly outsideItems = computed(() => {
    const t = this.tripService.activeTrip();
    return this.allItems().filter(i => isOutsideTripDates(i.date, t)).sort((a, b) => a.date.localeCompare(b.date));
  });
  isOutside(item: ItineraryItemDoc): boolean { return isOutsideTripDates(item.date, this.tripService.activeTrip()); }
  readonly tripRangeLabel = computed(() => {
    const t = this.tripService.activeTrip();
    return t?.startDate && t?.endDate ? stopDateRange(t.startDate, t.endDate) : '';
  });
  /** Show everyone's items on the first outside date, where the flagged ones are. */
  reviewOutside(): void {
    const first = this.outsideItems()[0];
    if (!first) return;
    this.showAll.set(true);
    this.selectedDate.set(first.date);
    if (this.view() !== 'list') this.setView('list');
  }

  // ── Add to my calendar ────────────────────────────────────────────────────
  private calendarExport = inject(CalendarExportService);
  readonly calExporting = signal(false);
  readonly calExportNote = signal('');
  async addToCalendar(): Promise<void> {
    this.calExporting.set(true);
    this.calExportNote.set('');
    try {
      this.calExportNote.set(calendarNote(await this.calendarExport.export()));
    } catch {
      this.calExportNote.set('Couldn’t make the calendar file. Try again.');
    } finally {
      this.calExporting.set(false);
    }
  }

  // ── User flight range for "My Trip" ───────────────────────────────────────
  readonly userFlightRange = computed((): { start: string; end: string } | null => {
    const uid     = this.currentUser()?.uid ?? '';
    const flights = this.flightsService.flights().filter(f => f.uid === uid);
    if (!flights.length) return null;

    const arrivals   = flights.filter(f => f.section === 'ARRIVALS');
    const departures = flights.filter(f => f.section === 'DEPARTURES');
    const start = arrivals.length   ? [...arrivals.map(f => f.arrivalDate)].sort().at(-1)!   : '';
    const end   = departures.length ? [...departures.map(f => f.departureDate)].sort()[0]    : '';
    return start || end ? { start, end } : null;
  });

  // ── Visible dates (for chip bar) ──────────────────────────────────────────
  readonly visibleDates = computed(() => {
    const all   = this.showAll();
    const range = this.userFlightRange();
    const days  = this.tripDays();

    // Include any dates with items that aren't in the trip days list
    const itemDates      = new Set(this.allItems().map(i => i.date));
    const flightDates    = new Set(this.flightEvents().map(e => e.date));
    const transportDates = new Set(this.transportEvents().map(e => e.date));
    const stayDates      = new Set(this.stayEvents().map(e => e.date));
    const allDates   = [...new Set([...days, ...itemDates, ...flightDates, ...transportDates, ...stayDates])].sort();

    if (all || !range) return allDates;
    return allDates.filter(d =>
      (!range.start || d >= range.start) && (!range.end || d <= range.end)
    );
  });

  // ── Filtered items ────────────────────────────────────────────────────────
  readonly filteredItems = computed(() => {
    const me    = this.currentUser()?.name ?? '';
    const date  = this.selectedDate();
    const all   = this.showAll();
    const range = this.userFlightRange();

    return this.allItems().filter(item => {
      const dateMatch  = date === 'All' || item.date === date;
      const whoMatch   = all || item.forWho === 'All' ||
        item.forWho.split(',').map(s => s.trim()).includes(me);
      const rangeMatch = all || !range ||
        ((!range.start || item.date >= range.start) && (!range.end || item.date <= range.end));
      return dateMatch && whoMatch && rangeMatch;
    });
  });

  readonly groupedByDay = computed((): [string, ItineraryItemDoc[]][] => {
    const groups: Record<string, ItineraryItemDoc[]> = {};
    for (const item of this.filteredItems()) {
      if (!groups[item.date]) groups[item.date] = [];
      groups[item.date].push(item);
    }
    // Include visible dates with no items so "Add event" still shows,
    // but only for the selected date (or all dates when showing all).
    const selected = this.selectedDate();
    const datesToPad = selected === 'All' ? this.visibleDates() : [selected];
    for (const date of datesToPad) {
      if (!groups[date]) groups[date] = [];
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  });

  readonly calendarDays = computed(() => {
    const me  = this.currentUser()?.name ?? '';
    const all = this.showAll();
    return this.visibleDates().map(date => ({
      date,
      label: this.effectiveDayLabel(date),
      items: this.allItems().filter(i => {
        if (i.date !== date) return false;
        if (all) return true;
        return i.forWho === 'All' || i.forWho.split(',').map(s => s.trim()).includes(me);
      }),
      isSelected: this.selectedDate() === date,
    }));
  });

  // ── Reset selectedDate when out of range ──────────────────────────────────
  constructor() {
    effect(() => {
      const visible  = this.visibleDates();
      const selected = this.selectedDate();
      if (selected !== 'All' && !visible.includes(selected)) {
        untracked(() => this.selectedDate.set('All'));
      }
    });
  }

  ngOnInit(): void {
    const uid = this.currentUser()?.uid;
    if (uid) this.itineraryService.loadDayLabels(uid);
  }

  /** Deep link (`?focus=<item id>` from the bell or a push): show that item's day. */
  readonly focusMissing = this.focus.missing;
  private readonly focusDayEffect = effect(() => {
    const id = this.focus.id();
    if (!id || !this.itineraryService.loaded()) return;
    const date = focusDate(this.itineraryService.items(), id);
    if (date) untracked(() => { this.view.set('list'); this.selectedDate.set(date); });
    else untracked(() => this.focus.markMissing());
  });

  // ── ForWho helpers ─────────────────────────────────────────────────────────
  private buildForWho(map: Record<string, boolean>): string {
    const users    = this.tripUsers();
    const selected = users.filter(u => map[u.name]).map(u => u.name);
    return selected.length === users.length ? 'All' : selected.join(', ');
  }

  private parseForWhoToMap(forWho: string): Record<string, boolean> {
    const names = forWho.split(',').map(s => s.trim());
    const map: Record<string, boolean> = {};
    for (const u of this.tripUsers()) {
      map[u.name] = forWho === 'All' || names.includes(u.name);
    }
    return map;
  }

  isAllForWhoSelected(map: Record<string, boolean>): boolean {
    return this.tripUsers().every(u => map[u.name]);
  }

  toggleAllForWho(map: Record<string, boolean>): void {
    const val = !this.isAllForWhoSelected(map);
    for (const u of this.tripUsers()) map[u.name] = val;
  }

  // ── Time helpers ───────────────────────────────────────────────────────────
  // ── Edit helpers ───────────────────────────────────────────────────────────
  isEditing(item: ItineraryItemDoc): boolean { return this.editingId() === item.id; }

  startEdit(item: ItineraryItemDoc): void {
    this.addingToDate.set(null);
    this.editingId.set(item.id);
    this.draft = { ...item };
    this.editForWhoMap = this.parseForWhoToMap(item.forWho);
  }

  cancelEdit(): void { this.editingId.set(null); this.draft = {}; this.editForWhoMap = {}; }

  async saveEdit(original: ItineraryItemDoc): Promise<void> {
    if (!this.draft.activity?.trim()) return;
    await this.itineraryService.updateItem(original.id, {
      ...this.draft,
      time:    this.draft.time    ?? '',
      endTime: this.draft.endTime ?? '',
      forWho:  this.buildForWho(this.editForWhoMap),
    });
    this.cancelEdit();
  }

  async deleteItem(item: ItineraryItemDoc): Promise<void> {
    await this.itineraryService.deleteItem(item.id);
    this.cancelEdit();
  }

  // ── Add helpers ────────────────────────────────────────────────────────────
  startAdd(date: string): void {
    this.cancelEdit();
    this.addingToDate.set(date);
    this.newDraft = { date, time: '', endTime: '', activity: '', location: '', category: 'Activity', notes: '' };
    this.addForWhoMap = this.parseForWhoToMap('All');
  }

  cancelAdd(): void { this.addingToDate.set(null); this.newDraft = {}; this.addForWhoMap = {}; }

  async saveAdd(): Promise<void> {
    const date = this.addingToDate();
    if (!date || !this.newDraft.activity?.trim()) return;
    const dayItems   = this.allItems().filter(i => i.date === date);
    const sortOrder  = dayItems.length;
    await this.itineraryService.addItem({
      date,
      time:       this.newDraft.time    ?? '',
      endTime:    this.newDraft.endTime ?? '',
      activity:   this.newDraft.activity  ?? '',
      location:   this.newDraft.location  ?? '',
      category:   this.newDraft.category  ?? 'Activity',
      notes:      this.newDraft.notes     ?? '',
      forWho:     this.buildForWho(this.addForWhoMap),
      addedByUid: this.currentUser()?.uid ?? '',
      sortOrder,
      createdAt:  Date.now(),
    });
    this.cancelAdd();
  }

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  async onDrop(event: CdkDragDrop<ItineraryItemDoc[]>, date: string): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    const items = [...this.allItems().filter(i => i.date === date)];
    const [moved] = items.splice(event.previousIndex, 1);
    items.splice(event.currentIndex, 0, moved);
    await this.itineraryService.reorderDay(items);
  }

  // ── View helpers ───────────────────────────────────────────────────────────
  setView(v: ViewMode): void { this.view.set(v); }
  setDate(d: string): void   { this.selectedDate.set(d); }

  openDay(date: string): void {
    this.selectedDate.set(date);
    this.view.set('list');
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  flightEventsForDate(date: string) {
    return this.flightEvents().filter(e => e.date === date);
  }

  categoryColor(cat: string): string {
    const map: Record<string, string> = {
      'Food': '#F9E4B7', 'Drink': '#F9E4B7',
      'Sightseeing': '#88C9A1', 'Culture': '#88C9A1',
      'Transport': '#B5D5F5', 'Travel': '#B5D5F5',
      'Accommodation': '#D4B5F5',
      'Activity': '#F4C2C2',
      'Free': '#E2EDE8',
    };
    return map[cat] ?? '#E2EDE8';
  }
}

/** One line under the button saying what happened. */
export function calendarNote(r: CalendarExportResult): string {
  switch (r.kind) {
    case 'downloaded': return 'Downloaded. Open the file to add your trip to Calendar.';
    case 'opened':     return 'Tap “Add All” to put your trip in Calendar.';
    case 'shared':     return 'Choose where to save your trip’s calendar file.';
    case 'empty':      return 'Nothing on your trip to add yet.';
    case 'no-access':  return 'Calendar access is off, so here is the file instead. Turn it on in Settings › Privacy › Calendars.';
    case 'synced': {
      const parts = [r.added && `added ${r.added}`, r.updated && `updated ${r.updated}`, r.removed && `removed ${r.removed}`].filter(Boolean);
      return parts.length ? `In Calendar: ${parts.join(', ')}.` : 'Calendar is already up to date.';
    }
  }
}

