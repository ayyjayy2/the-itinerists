import { Component, OnInit, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { DataService } from '../../services/data.service';
import { UserService } from '../../services/user.service';
import { WeatherService, weatherEmoji, LiveWeather } from '../../services/weather.service';
import { ItineraryItem } from '../../models/trip.models';

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
  dataService    = inject(DataService);
  userService    = inject(UserService);
  weatherService = inject(WeatherService);

  weatherEmoji = weatherEmoji;

  view         = signal<ViewMode>('list');
  selectedDate = signal<string>('All');
  currentUser  = this.userService.currentUser;

  /** true = show everyone's items, false = show only current user's items */
  showAll = signal<boolean>(true);

  // ── Edit state ─────────────────────────────────────────────────────────────
  editingKey    = signal<string | null>(null);
  draft: Partial<ItineraryItem> = {};
  editForWhoMap: Record<string, boolean> = {};

  // ── Add state ──────────────────────────────────────────────────────────────
  addingToDate = signal<string | null>(null);
  newDraft: Partial<ItineraryItem> = {};
  addForWhoMap: Record<string, boolean> = {};

  readonly categories = CATEGORIES;

  // ── Data ───────────────────────────────────────────────────────────────────
  allItems     = computed(() => this.dataService.data()?.itinerary ?? []);
  weatherByDate = computed(() => this.dataService.data()?.weatherByDate ?? {});
  users        = computed(() => (this.dataService.data()?.users ?? []).filter(u => u.name !== 'Arielle'));
  userNames    = computed(() => this.users().map(u => u.name).join(', '));

  uniqueDates = computed(() => {
    const dates = new Set(this.allItems().map(i => i.date));
    return Array.from(dates).sort();
  });

  dayLabels = computed(() => {
    const map: Record<string, string> = {};
    for (const item of this.allItems()) map[item.date] = item.dayLabel;
    return map;
  });

  // ── "My Trip" flight date range ────────────────────────────────────────────

  /** Ireland arrival / departure dates for the current user based on their flights. */
  userFlightRange = computed((): { start: string; end: string } | null => {
    const user = this.currentUser();
    if (!user) return null;
    const flights = this.dataService.data()?.flights ?? [];

    const mine = flights.filter(f => this.matchesUser(f.person, user.name));
    if (!mine.length) return null;

    const arrivals   = mine.filter(f => f.section === 'ARRIVALS');
    const departures = mine.filter(f => f.section === 'DEPARTURES');

    // Last leg arrival date = day they land in Ireland
    const start = arrivals.length
      ? [...arrivals.map(f => f.arrivalDate)].sort().at(-1)!
      : '';

    // First leg departure date = day they leave Ireland
    const end = departures.length
      ? [...departures.map(f => f.departureDate)].sort()[0]
      : '';

    return start || end ? { start, end } : null;
  });

  /** Dates visible in the chip picker — filtered by flight range in "My Trip" mode. */
  visibleDates = computed(() => {
    const all   = this.showAll();
    const range = this.userFlightRange();
    const dates = this.uniqueDates();
    if (all || !range) return dates;
    return dates.filter(d =>
      (!range.start || d >= range.start) &&
      (!range.end   || d <= range.end)
    );
  });

  filteredItems = computed(() => {
    const me    = this.currentUser()?.name ?? '';
    const date  = this.selectedDate();
    const all   = this.showAll();
    const range = this.userFlightRange();

    return this.allItems().filter(item => {
      const dateMatch  = date === 'All' || item.date === date;
      const whoMatch   = all || item.forWho === 'All' ||
        item.forWho.split(',').map(s => s.trim()).includes(me);
      const rangeMatch = all || !range ||
        ((!range.start || item.date >= range.start) &&
         (!range.end   || item.date <= range.end));
      return dateMatch && whoMatch && rangeMatch;
    });
  });

  groupedByDay = computed(() => {
    const groups: Record<string, ItineraryItem[]> = {};
    for (const item of this.filteredItems()) {
      if (!groups[item.date]) groups[item.date] = [];
      groups[item.date].push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  });

  calendarDays = computed(() => {
    const me  = this.currentUser()?.name ?? '';
    const all = this.showAll();
    return this.visibleDates().map(date => ({
      date,
      label:      this.dayLabels()[date] ?? date,
      items:      this.allItems().filter(i => {
        if (i.date !== date) return false;
        if (all) return true;
        return i.forWho === 'All' || i.forWho.split(',').map(s => s.trim()).includes(me);
      }),
      isSelected: this.selectedDate() === date,
    }));
  });

  // ── Reset selectedDate when it falls outside the visible range ─────────────
  constructor() {
    effect(() => {
      const visible  = this.visibleDates();
      const selected = this.selectedDate();
      if (selected !== 'All' && !visible.includes(selected)) {
        untracked(() => this.selectedDate.set('All'));
      }
    });
  }

  // ── Name matching: handles nicknames like Maddie → Madeleine ───────────────
  private matchesUser(flightPerson: string, userName: string): boolean {
    const person = flightPerson.toLowerCase();
    const name   = userName.toLowerCase();
    if (person.includes(name)) return true;
    // Fallback: first 3 chars catches short nicknames (Maddie ↔ Madeleine)
    if (name.length >= 3 && person.includes(name.substring(0, 3))) return true;
    return false;
  }

  // ── For-Who helpers ────────────────────────────────────────────────────────
  private buildForWho(map: Record<string, boolean>): string {
    const selected = this.users().filter(u => map[u.name]).map(u => u.name);
    return selected.length === this.users().length ? 'All' : selected.join(', ');
  }

  private parseForWhoToMap(forWho: string): Record<string, boolean> {
    const names = forWho.split(',').map(s => s.trim());
    const map: Record<string, boolean> = {};
    for (const u of this.users()) {
      map[u.name] = forWho === 'All' || names.includes(u.name);
    }
    return map;
  }

  isAllForWhoSelected(map: Record<string, boolean>): boolean {
    return this.users().every(u => map[u.name]);
  }

  toggleAllForWho(map: Record<string, boolean>): void {
    const val = !this.isAllForWhoSelected(map);
    for (const u of this.users()) map[u.name] = val;
  }

  // ── Time helpers ───────────────────────────────────────────────────────────
  /** "H:MM AM/PM [TZ]" → "HH:MM" (for <input type="time">) */
  private formatTime24h(t: string): string {
    if (!t) return '';
    const clean = t.replace(/\s+(CT|ET|PT|MT|IST)$/i, '').trim();
    const m = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return '';
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  /** "HH:MM" (from <input type="time">) → "H:MM AM/PM" */
  private formatTime12h(t: string): string {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12  = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  // ── Edit helpers ───────────────────────────────────────────────────────────
  itemKey(item: ItineraryItem): string { return `${item.date}::${item.activity}`; }

  isEditing(item: ItineraryItem): boolean { return this.editingKey() === this.itemKey(item); }

  startEdit(item: ItineraryItem): void {
    this.addingToDate.set(null);
    this.editingKey.set(this.itemKey(item));
    this.draft = {
      ...item,
      time:    this.formatTime24h(item.time),
      endTime: this.formatTime24h(item.endTime ?? ''),
    };
    this.editForWhoMap = this.parseForWhoToMap(item.forWho);
  }

  cancelEdit(): void {
    this.editingKey.set(null);
    this.draft = {};
    this.editForWhoMap = {};
  }

  saveEdit(original: ItineraryItem): void {
    if (!this.draft.activity?.trim()) return;
    const time    = this.formatTime12h(this.draft.time ?? '');
    const endTime = this.formatTime12h(this.draft.endTime ?? '');
    const forWho  = this.buildForWho(this.editForWhoMap);
    this.dataService.patchItineraryItem(original.date, original.activity, { ...this.draft, time, endTime, forWho });
    this.dataService.sortItineraryDay(original.date);
    this.editingKey.set(null);
    this.draft = {};
    this.editForWhoMap = {};
  }

  deleteItem(item: ItineraryItem): void {
    this.dataService.deleteItineraryItem(item.date, item.activity);
    this.editingKey.set(null);
    this.draft = {};
    this.editForWhoMap = {};
  }

  // ── Add helpers ────────────────────────────────────────────────────────────
  startAdd(date: string): void {
    this.editingKey.set(null);
    this.addingToDate.set(date);
    this.newDraft = {
      date,
      dayLabel: this.dayLabels()[date] ?? '',
      time: '', endTime: '', activity: '', location: '',
      category: 'Activity', notes: '',
    };
    this.addForWhoMap = this.parseForWhoToMap('All');
  }

  cancelAdd(): void {
    this.addingToDate.set(null);
    this.newDraft = {};
    this.addForWhoMap = {};
  }

  saveAdd(): void {
    const date = this.addingToDate();
    if (!date || !this.newDraft.activity?.trim()) return;
    this.dataService.addItineraryItem({
      date,
      dayLabel: this.dayLabels()[date] ?? '',
      time:     this.formatTime12h(this.newDraft.time ?? ''),
      endTime:  this.formatTime12h(this.newDraft.endTime ?? ''),
      activity: this.newDraft.activity ?? '',
      location: this.newDraft.location ?? '',
      category: this.newDraft.category ?? 'Activity',
      notes:    this.newDraft.notes    ?? '',
      forWho:   this.buildForWho(this.addForWhoMap),
    });
    this.addingToDate.set(null);
    this.newDraft = {};
    this.addForWhoMap = {};
  }

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  onDrop(event: CdkDragDrop<ItineraryItem[]>, date: string): void {
    if (event.previousIndex === event.currentIndex) return;
    this.dataService.moveItineraryItem(date, event.previousIndex, event.currentIndex);
  }

  // ── View helpers ───────────────────────────────────────────────────────────
  setView(v: ViewMode): void { this.view.set(v); }

  openDay(date: string): void {
    this.selectedDate.set(date);
    this.view.set('list');
  }

  setDate(d: string): void { this.selectedDate.set(d); }

  formatDate(d: string): string {
    if (!d) return '';
    const dt = new Date(d + 'T00:00');
    return dt.toLocaleDateString('en-IE', { weekday: 'long', month: 'long', day: 'numeric' });
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

  ngOnInit(): void {
    this.weatherService.load();
  }

  /** Map of date → live weather for that day's primary Irish city. */
  liveWeatherByDate = computed((): Record<string, LiveWeather | null> => {
    const weather  = this.weatherService.weather();
    const allItems = this.allItems();
    const result: Record<string, LiveWeather | null> = {};
    for (const date of this.uniqueDates()) {
      let city: string | null = null;
      for (const a of allItems.filter(i => i.date === date)) {
        const c = this.detectCity(a.location ?? '');
        if (c) city = c;
      }
      result[date] = city ? (weather[`${date}_${city}`] ?? null) : null;
    }
    return result;
  });

  private detectCity(location: string): string | null {
    const loc = location.toLowerCase();
    if (/belfast|causeway|antrim|banbridge|voco/.test(loc))  return 'Belfast';
    if (/galway/.test(loc))                                   return 'Galway';
    if (/killarney|kerry|waterville|horseshoe/.test(loc))     return 'Killarney';
    if (/cork|stationview/.test(loc))                         return 'Cork';
    if (/wicklow|waterford|cliffs|moher|clare/.test(loc))     return 'Dublin';
    if (/dublin|arthaus|heuston|skylon/.test(loc))            return 'Dublin';
    return null;
  }

  refresh(): void { this.dataService.refresh(); }
}
