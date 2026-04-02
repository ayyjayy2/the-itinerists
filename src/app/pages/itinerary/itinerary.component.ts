import { Component, OnInit, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { ItineraryService } from '../../services/itinerary.service';
import { UserService } from '../../services/user.service';
import { UsersService } from '../../services/users.service';
import { FlightsService } from '../../services/flights.service';
import { TripConfigService } from '../../services/trip-config.service';
import { ItineraryItemDoc } from '../../models/trip.models';

type ViewMode = 'list' | 'calendar';

const CATEGORIES = [
  'Food', 'Drink', 'Sightseeing', 'Culture',
  'Transport', 'Accommodation', 'Activity', 'Free',
];

@Component({
  selector: 'app-itinerary',
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './itinerary.component.html',
  styleUrl: './itinerary.component.scss'
})
export class ItineraryComponent implements OnInit {
  itineraryService  = inject(ItineraryService);
  userService       = inject(UserService);
  usersService      = inject(UsersService);
  flightsService    = inject(FlightsService);
  tripConfigService = inject(TripConfigService);

  view         = signal<ViewMode>('list');
  selectedDate = signal<string>('All');
  currentUser  = this.userService.currentUser;
  showAll      = signal<boolean>(false);

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

  // ── Trip days from config ──────────────────────────────────────────────────
  readonly tripDays = computed((): string[] => {
    const cfg = this.tripConfigService.config();
    if (!cfg?.startDate || !cfg?.endDate) return [];
    const days: string[] = [];
    const cur = new Date(cfg.startDate + 'T00:00');
    const end = new Date(cfg.endDate   + 'T00:00');
    while (cur <= end) {
      days.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  });

  effectiveDayLabel(date: string): string {
    const custom = this.itineraryService.dayLabels()[date];
    if (custom) return custom;
    const cfg = this.tripConfigService.config();
    if (!cfg?.startDate) return date;
    const start = new Date(cfg.startDate + 'T00:00');
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

  /** Auto-generated flight events for the current user — not stored, not editable. */
  readonly flightEvents = computed(() => {
    const uid     = this.currentUser()?.uid ?? '';
    const dest    = this.tripConfigService.config()?.locationLabel ?? 'Savannah';
    const flights = this.flightsService.flights();
    const mine    = flights.filter(f => f.uid === uid);

    const events: Array<{ date: string; label: string; time: string }> = [];

    // Last arrival leg per date
    const arrivalsByDate = mine.filter(f => f.section === 'ARRIVALS');
    for (const f of arrivalsByDate) {
      events.push({ date: f.arrivalDate, label: `✈️ Arrive at ${f.to} – ${dest}`, time: f.arrivalTime });
    }
    // First departure leg per date
    const departuresByDate = mine.filter(f => f.section === 'DEPARTURES');
    for (const f of departuresByDate) {
      events.push({ date: f.departureDate, label: `✈️ Depart from ${f.from}`, time: f.departureTime });
    }
    return events;
  });

  readonly tripUsers = this.usersService.tripUsers;

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
    const itemDates  = new Set(this.allItems().map(i => i.date));
    const flightDates = new Set(this.flightEvents().map(e => e.date));
    const allDates   = [...new Set([...days, ...itemDates, ...flightDates])].sort();

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
  private formatTime24h(t: string): string {
    if (!t) return '';
    const clean = t.replace(/\s+(CT|ET|PT|MT|IST|CDT|EDT|CST|EST)$/i, '').trim();
    const m = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return '';
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  private formatTime12h(t: string): string {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12  = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  // ── Edit helpers ───────────────────────────────────────────────────────────
  isEditing(item: ItineraryItemDoc): boolean { return this.editingId() === item.id; }

  startEdit(item: ItineraryItemDoc): void {
    this.addingToDate.set(null);
    this.editingId.set(item.id);
    this.draft = { ...item, time: this.formatTime24h(item.time), endTime: this.formatTime24h(item.endTime) };
    this.editForWhoMap = this.parseForWhoToMap(item.forWho);
  }

  cancelEdit(): void { this.editingId.set(null); this.draft = {}; this.editForWhoMap = {}; }

  async saveEdit(original: ItineraryItemDoc): Promise<void> {
    if (!this.draft.activity?.trim()) return;
    await this.itineraryService.updateItem(original.id, {
      ...this.draft,
      time:    this.formatTime12h(this.draft.time    ?? ''),
      endTime: this.formatTime12h(this.draft.endTime ?? ''),
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
      time:       this.formatTime12h(this.newDraft.time    ?? ''),
      endTime:    this.formatTime12h(this.newDraft.endTime ?? ''),
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
