import { Component, OnInit, OnDestroy, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';
import { BrandComponent } from '../../shared/brand/brand.component';
import { DayMapCardComponent } from '../../shared/day-map-card/day-map-card.component';
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
import { tripDestinations, activeLeg, legIsCurrent, localTodayISO } from '../../utils/trip-destinations';
import { effectivePins } from '../../utils/pins';
import { activityText as activityLine, timeAgo as agoOf } from '../../utils/activity';
import { effectiveHomeLayout } from '../../utils/layout';
import { flightMomentsForUid } from '../../utils/flight-events';
import { pickFirstUp } from '../../utils/first-up';
import { normalizeTime } from '../../utils/time-format';
import { weatherLabel } from '../../utils/weather-label';
import { needsRecoveryEmail } from '../../utils/email';
import { AvatarGlyphComponent } from '../../shared/avatar-glyph/avatar-glyph.component';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterLink, IconComponent, BrandComponent, DayMapCardComponent, AvatarGlyphComponent],
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

  readonly layout = computed(() => effectiveHomeLayout(this.userService.firestoreUser()));

  // ── Recovery-email nudge: accounts still on the synthetic address can't reset
  //    their own password. Dismissal is per device (a convenience, not data). ──
  private nudgeDismissed = signal(false);
  readonly showRecoveryNudge = computed(() => {
    const u = this.userService.firestoreUser();
    if (!needsRecoveryEmail(u) || this.nudgeDismissed()) return false;
    try { return localStorage.getItem(`recoveryNudgeDismissed:${u!.uid}`) !== '1'; } catch { return true; }
  });
  dismissRecoveryNudge(): void {
    const uid = this.userService.firestoreUser()?.uid;
    try { if (uid) localStorage.setItem(`recoveryNudgeDismissed:${uid}`, '1'); } catch { /* private mode */ }
    this.nudgeDismissed.set(true);
  }
  readonly isLayoutA = computed(() => this.layout() === 'A');

  /** Type B "Quick Access" — every page, old-layout style. */
  readonly quickAccess = [
    { path: '/trips',          label: 'My Trips',       icon: 'trips',     desc: 'All trips · switch active',   accent: '#88C9A1' },
    { path: '/itinerary',      label: 'Itinerary',      icon: 'itinerary', desc: 'Day-by-day plans',            accent: '#F9E4B7' },
    { path: '/flights',        label: 'Flights',        icon: 'flights',   desc: 'Arrivals & departures',       accent: '#B5D5F5' },
    { path: '/accommodations', label: 'Stays',          icon: 'stays',     desc: 'Hotels & check-in',           accent: '#D4B5F5' },
    { path: '/transportation', label: 'Transportation', icon: 'car',       desc: 'Rental car & getting around', accent: '#F5D4B5' },
    { path: '/finance',        label: 'Finance',        icon: 'finance',   desc: 'Shared expenses',             accent: '#88C9A1' },
    { path: '/expenses',       label: 'My Expenses',    icon: 'expenses',  desc: 'Your private spending',       accent: '#F4C2C2' },
    { path: '/recs',           label: 'Recs',           icon: 'recs',      desc: 'Tips & spots',                accent: '#F5B5D4' },
    { path: '/packing',        label: 'Packing',        icon: 'packing',   desc: 'Your packing list',           accent: '#B5F5D4' },
    { path: '/outfits',        label: 'Outfits',        icon: 'outfits',   desc: 'Plan your looks',             accent: '#F5B5D4' },
    { path: '/map',            label: 'Map',            icon: 'map',       desc: 'Trip map',                    accent: '#B5D5F5' },
    { path: '/profile',        label: 'Profile',        icon: 'profile',   desc: 'Settings & account',          accent: '#F9E4B7' },
  ];

  // ── Pinned quick-shortcuts (stored on the account — follows the user) ──────
  private readonly LEGACY_PINS_KEY = 'tripplanner_home_pins';
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
  readonly pins = computed(() => effectivePins(this.userService.firestoreUser()));
  pinEdit = signal(false);
  readonly pinnedTiles = computed(() => {
    const set = new Set(this.pins());
    return this.pinnablePages.filter(p => set.has(p.path));
  });
  togglePinEdit(): void { this.pinEdit.update(v => !v); }
  isPinned(path: string): boolean { return this.pins().includes(path); }
  togglePin(path: string): void {
    const cur  = this.pins();
    const next = cur.includes(path) ? cur.filter(p => p !== path) : [...cur, path];
    void this.userService.updateHomePins(next);
  }
  /** One-time: carry device-local pins (pre-account era) onto the account. */
  private migrateLegacyPins(): void {
    try {
      const raw = localStorage.getItem(this.LEGACY_PINS_KEY);
      if (!raw) return;
      const user = this.userService.firestoreUser();
      if (!user) return; // profile not loaded yet — try again next visit
      if (user.homePins === undefined) {
        void this.userService.updateHomePins(JSON.parse(raw));
      }
      localStorage.removeItem(this.LEGACY_PINS_KEY);
    } catch { /* ignore bad local data */ }
  }

  constructor() {
    // Load weather for every destination leg so the glance shows the right city.
    effect(() => {
      const t = this.activeTrip();
      if (t) this.weatherService.loadMany(tripDestinations(t));
    });
    // Migrate pre-account localStorage pins once the profile is available.
    effect(() => {
      if (this.userService.firestoreUser()) this.migrateLegacyPins();
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

  /** "now" chip: only when today actually falls inside the leg's dates —
   *  before the trip starts, no leg is "now" (currentLeg() would return the
   *  next upcoming leg, which is for glance cards, not this label). */
  isCurrentLeg(leg: TripDestination): boolean {
    return legIsCurrent(leg, localTodayISO(new Date(this.now())));
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
   * The next thing on the schedule — time-aware, merging manual itinerary
   * items with the user's real flights so the card never shows a stale
   * hand-typed time when the Flights page knows better. An event stays
   * "first up" until it finishes, then the card rolls to the next one.
   * Events with no time hold for their whole day. When everything has
   * passed, we fall back to the last event.
   */
  readonly firstUp = computed(() => {
    const uid  = this.currentUser()?.uid ?? '';
    const dest = this.activeTrip()?.destination ?? 'your destination';
    const flights = flightMomentsForUid(this.flightsService.flights(), uid, dest);
    return pickFirstUp(this.itineraryService.items(), flights, this.now());
  });

  readonly firstUpWhen = computed(() => {
    const e = this.firstUp();
    if (!e) return '';
    const d = new Date(e.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return e.time ? `${d} · ${normalizeTime(e.time)}` : d;
  });

  /** Up to 3 unpacked items, surfaced on the glance card as the next to grab. */
  readonly nextToPack = computed(() =>
    this.packingService.items().filter(i => !i.packed).slice(0, 3).map(i => i.label));

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

  /** Condition (emoji + word) for the glance card's forecast day. */
  readonly weatherCondition = computed(() => {
    const w = this.weatherGlance();
    return w ? weatherLabel(w.code) : null;
  });

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

  activityText(a: ActivityLogEntry): string { return activityLine(a); }

  timeAgo(ts: number): string { return agoOf(ts, this.now()); }

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
