import { Component, OnInit, OnDestroy, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';
import { BrandComponent } from '../../shared/brand/brand.component';
import { UserService } from '../../services/user.service';
import { FlightCountdownService } from '../../services/flight-countdown.service';
import { FlightsService } from '../../services/flights.service';
import { TripService } from '../../services/trip.service';
import { TripContextService } from '../../services/trip-context.service';
import { ItineraryService } from '../../services/itinerary.service';
import { FinanceService } from '../../services/finance.service';
import { PackingService } from '../../services/packing.service';
import { WeatherService } from '../../services/weather.service';
import { TripDoc, TripDestination, ActivityLogEntry } from '../../models/trip.models';
import { tripDestinations, activeLeg } from '../../utils/trip-destinations';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterLink, IconComponent, BrandComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  userService     = inject(UserService);
  flightCountdown = inject(FlightCountdownService);
  flightsService  = inject(FlightsService);
  tripService     = inject(TripService);
  tripContext     = inject(TripContextService);
  itineraryService = inject(ItineraryService);
  financeService   = inject(FinanceService);
  packingService   = inject(PackingService);
  weatherService   = inject(WeatherService);

  currentUser = this.userService.currentUser;
  isAdmin     = this.userService.isAdmin;

  readonly activeTrip    = this.tripService.activeTrip;
  readonly hasActiveTrip = computed(() => this.activeTrip() !== null);
  readonly members       = this.tripService.activeMembers;

  private now = signal(Date.now());
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  /** The user's trips, for the switcher row. */
  readonly trips = signal<TripDoc[]>([]);

  // ── Pinned quick-shortcuts (customizable) ──────────────────────────────────
  private readonly PINS_KEY = 'tripplanner_home_pins';
  readonly pinnablePages = [
    { path: '/itinerary',      label: 'Itinerary',   icon: 'itinerary' },
    { path: '/flights',        label: 'Flights',     icon: 'flights' },
    { path: '/accommodations', label: 'Stays',       icon: 'stays' },
    { path: '/transportation', label: 'Transportation', icon: 'car' },
    { path: '/finance',        label: 'Finance',     icon: 'finance' },
    { path: '/expenses',       label: 'My Expenses', icon: 'expenses' },
    { path: '/recs',           label: 'Recs',        icon: 'recs' },
    { path: '/packing',        label: 'Packing',     icon: 'packing' },
    { path: '/outfits',        label: 'Outfits',     icon: 'outfits' },
    { path: '/map',            label: 'Map',         icon: 'map' },
    { path: '/profile',        label: 'Profile',     icon: 'profile' },
  ];
  readonly pins = signal<string[]>(this.readPins());
  pinEdit = signal(false);
  readonly pinnedTiles = computed(() => {
    const set = new Set(this.pins());
    return this.pinnablePages.filter(p => set.has(p.path));
  });
  togglePinEdit(): void { this.pinEdit.update(v => !v); }
  isPinned(path: string): boolean { return this.pins().includes(path); }
  togglePin(path: string): void {
    const cur = this.pins();
    const next = cur.includes(path) ? cur.filter(p => p !== path) : [...cur, path];
    this.pins.set(next);
    try { localStorage.setItem(this.PINS_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  }
  private readPins(): string[] {
    try { const v = localStorage.getItem(this.PINS_KEY); if (v) return JSON.parse(v); } catch { /* ignore */ }
    return ['/itinerary', '/finance', '/packing', '/recs']; // sensible defaults
  }

  /** Feature teaser shown on the zero-trips welcome state. */
  readonly teaserFeatures = [
    { icon: 'itinerary', label: 'Itinerary' },
    { icon: 'finance',   label: 'Shared budget' },
    { icon: 'flights',   label: 'Flights' },
    { icon: 'stays',     label: 'Stays' },
    { icon: 'packing',   label: 'Packing' },
    { icon: 'outfits',   label: 'Outfits' },
  ];

  constructor() {
    // Load weather for every destination leg so the glance shows the right city.
    effect(() => {
      const t = this.activeTrip();
      if (t) this.weatherService.loadMany(tripDestinations(t));
    });
  }

  // ── Destinations (multi-destination) ─────────────────────────────────────────
  readonly legs = computed<TripDestination[]>(() => {
    const t = this.activeTrip();
    return t ? tripDestinations(t) : [];
  });

  readonly isMultiDest = computed(() => this.legs().length > 1);

  /** The leg happening now, or the next upcoming one (for glances). */
  readonly currentLeg = computed<TripDestination | null>(() => {
    const t = this.activeTrip();
    if (!t) return null;
    const todayISO = new Date(this.now()).toISOString().slice(0, 10);
    return activeLeg(this.legs(), todayISO);
  });

  legShort(leg: TripDestination): string {
    return (leg.destination || '').split(',')[0].trim();
  }

  legDateRange(leg: TripDestination): string {
    const fmt = (s: string) => new Date(s + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(leg.startDate)} – ${fmt(leg.endDate)}`;
  }

  isCurrentLeg(leg: TripDestination): boolean {
    const c = this.currentLeg();
    return !!c && c.destination === leg.destination && c.startDate === leg.startDate;
  }

  // ── Hero ───────────────────────────────────────────────────────────────────
  readonly destinationShort = computed(() => {
    const t = this.activeTrip();
    return t ? (t.destination || t.name || '').split(',')[0].trim() : '';
  });

  readonly heroMembers = computed(() => this.members().slice(0, 5));

  readonly friendsLabel = computed(() => {
    const n = (this.activeTrip()?.memberCount ?? this.members().length) - 1;
    return n > 0 ? `you + ${n} friend${n !== 1 ? 's' : ''}` : 'just you';
  });

  readonly dateRangeLabel = computed(() => {
    const t = this.activeTrip();
    if (!t?.startDate || !t?.endDate) return '';
    const fmt = (s: string) => new Date(s + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const year = new Date(t.endDate + 'T00:00').getFullYear();
    return `${fmt(t.startDate)} – ${fmt(t.endDate)}, ${year}`;
  });

  /**
   * Countdown as a single big Caprasimo phrase (e.g. "76 days") — matches the
   * prototype where the number and "days" share the same display font/size.
   * `big` is the display phrase; `small` is only used for non-count states.
   */
  readonly heroCountdown = computed(() => {
    const t = this.activeTrip();
    const now = new Date(this.now());
    if (!t)                              return { big: '', small: 'No active trip' };
    if (!t.startDate || !t.endDate)      return { big: '', small: 'Dates not set yet' };
    const start = new Date(t.startDate + 'T00:00:00');
    const end   = new Date(t.endDate + 'T00:00:00');
    const diff  = start.getTime() - now.getTime();
    if (diff <= 0) {
      const rem = end.getTime() - now.getTime();
      if (rem > 0) { const d = Math.ceil(rem / 86_400_000); return { big: `${d} day${d !== 1 ? 's' : ''} left`, small: '' }; }
      return { big: '', small: 'Trip complete 🌿' };
    }
    const days = Math.floor(diff / 86_400_000);
    return { big: `${days} day${days !== 1 ? 's' : ''}`, small: '' };
  });

  // ── At a glance ────────────────────────────────────────────────────────────
  /**
   * The next thing on the schedule — time-aware. An event stays "first up" until
   * it finishes (its end time, or its start time when no end is set), then the
   * card rolls to the next one. Events with no time hold for their whole day.
   * When everything has passed, we fall back to the last event.
   */
  readonly firstUp = computed(() => {
    const items = [...this.itineraryService.items()];
    if (!items.length) return null;
    items.sort((a, b) => a.date === b.date ? a.sortOrder - b.sortOrder : a.date.localeCompare(b.date));
    const now = this.now();
    return items.find(i => this.eventCutoffMs(i) >= now) ?? items[items.length - 1];
  });

  /** Ms after which an event is considered past: end time, else start, else end-of-day. */
  private eventCutoffMs(i: { date: string; time: string; endTime: string }): number {
    const [y, m, d] = i.date.split('-').map(Number);
    const t = this.parseTime(i.endTime) ?? this.parseTime(i.time);
    return t
      ? new Date(y, m - 1, d, t.h, t.min).getTime()
      : new Date(y, m - 1, d, 23, 59, 59).getTime(); // no time set → holds for the whole day
  }

  /** Parses "2:30 PM", "9 am", "14:30" (any trailing TZ ignored) → 24h parts, or null. */
  private parseTime(raw?: string): { h: number; min: number } | null {
    if (!raw) return null;
    const s = raw.trim().toLowerCase();
    const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
    if (ampm) {
      let h = parseInt(ampm[1], 10) % 12;
      if (ampm[3] === 'pm') h += 12;
      return { h, min: ampm[2] ? parseInt(ampm[2], 10) : 0 };
    }
    const h24 = s.match(/^(\d{1,2}):(\d{2})/);
    if (h24) {
      const h = parseInt(h24[1], 10), min = parseInt(h24[2], 10);
      if (h < 24 && min < 60) return { h, min };
    }
    return null;
  }

  readonly firstUpWhen = computed(() => {
    const e = this.firstUp();
    if (!e) return '';
    const d = new Date(e.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return e.time ? `${d} · ${e.time}` : d;
  });

  readonly packingSummary = computed(() => {
    const items = this.packingService.items();
    return { total: items.length, packed: items.filter(i => i.packed).length };
  });

  readonly expenseCount = computed(() => this.financeService.entries().length);

  /**
   * Current user's net balance for the trip: positive = owed to you, negative =
   * you owe. A glance summary in the trip's currency (the Finance page is the
   * authoritative, settlement-aware view).
   */
  readonly financeNet = computed<number | null>(() => {
    const entries = this.financeService.entries();
    const me = this.currentUser()?.name;
    if (!me || !entries.length) return null;
    const memberNames = this.members().map(m => m.displayName);
    let net = 0;
    for (const e of entries) {
      const people = e.splitAmong === 'All'
        ? memberNames
        : e.splitAmong.split(',').map(s => s.trim()).filter(Boolean);
      if (!people.length) continue;
      const share = e.amount / people.length;
      const iAmIn = people.includes(me);
      if (e.paidBy === me)      net += e.amount - (iAmIn ? share : 0); // others owe me
      else if (iAmIn)          net -= share;                          // I owe the payer
    }
    return net;
  });

  /** Running total of every expense logged for the trip — "tracked so far". */
  readonly trackedTotal = computed(() =>
    this.financeService.entries().reduce((sum, e) => sum + (e.amount || 0), 0),
  );

  money(amount: number): string {
    const cur = this.activeTrip()?.currency || 'USD';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${cur}`;
    }
  }

  readonly weatherGlance = computed(() => {
    const t = this.activeTrip();
    if (!t) return null;
    const w = this.weatherService.weather();
    const todayISO = new Date(this.now()).toISOString().slice(0, 10);
    const leg = this.currentLeg();
    // Prefer today's forecast, else the current/next leg's first day, else any.
    return w[todayISO] ?? (leg ? w[leg.startDate] : null) ?? w[t.startDate] ?? Object.values(w)[0] ?? null;
  });

  /** Short name of the leg the glance is showing (for multi-destination trips). */
  readonly glanceLegShort = computed(() => {
    const leg = this.currentLeg();
    return leg ? this.legShort(leg) : this.destinationShort();
  });

  // ── Activity feed ──────────────────────────────────────────────────────────
  readonly recentActivity = computed(() => {
    const byUid = new Map(this.members().map(m => [m.uid, m]));
    return [...this.tripService.activeActivity()]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 4)
      .map(a => ({ entry: a, member: byUid.get(a.performedByUid) }));
  });

  activityText(a: ActivityLogEntry): string {
    switch (a.action) {
      case 'member_added':    return `${a.targetName} joined the trip`;
      case 'member_removed':  return `${a.performedByName} removed ${a.targetName}`;
      case 'member_left':     return `${a.targetName} left the trip`;
      case 'member_restored': return `${a.performedByName} added ${a.targetName} back`;
      default:                return 'updated the trip';
    }
  }

  timeAgo(ts: number): string {
    const s = Math.floor((this.now() - ts) / 1000);
    if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }

  // ── Switcher ───────────────────────────────────────────────────────────────
  isActive(t: TripDoc): boolean { return t.id === this.activeTrip()?.id; }
  async switchTo(t: TripDoc): Promise<void> {
    if (this.isActive(t)) return;
    await this.tripService.switchTrip(t.id);
  }

  ngOnInit(): void {
    this.countdownTimer = setInterval(() => this.now.set(Date.now()), 60_000);
    const uid = this.currentUser()?.uid;
    if (!uid) return;
    this.tripService.getUserTrips(uid).then(list => {
      const active = list.filter(t => !t.archived);
      this.trips.set(active);
      // If nothing is validly selected (no pointer, or a stale/purged one), pick a trip
      // so the dashboard shows instead of the empty "no trip" state.
      const current = this.tripContext.activeTripId();
      const valid = active.some(t => t.id === current);
      if (!valid && active.length) void this.tripService.switchTrip(active[0].id);
    });
  }

  ngOnDestroy(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }
}
