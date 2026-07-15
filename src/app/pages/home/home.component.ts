import { Component, OnInit, OnDestroy, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';
import { UserService } from '../../services/user.service';
import { FlightCountdownService } from '../../services/flight-countdown.service';
import { FlightsService } from '../../services/flights.service';
import { TripService } from '../../services/trip.service';
import { ItineraryService } from '../../services/itinerary.service';
import { FinanceService } from '../../services/finance.service';
import { PackingService } from '../../services/packing.service';
import { WeatherService } from '../../services/weather.service';
import { TripDoc, ActivityLogEntry } from '../../models/trip.models';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  userService     = inject(UserService);
  flightCountdown = inject(FlightCountdownService);
  flightsService  = inject(FlightsService);
  tripService     = inject(TripService);
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

  constructor() {
    // Load weather for the active trip so the glance card can show it.
    effect(() => {
      const t = this.activeTrip();
      if (t?.startDate && t?.endDate && t?.destination) {
        this.weatherService.load(t.startDate, t.endDate, t.destination);
      }
    });
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

  /** Countdown as a big number + caption (bold countdown hero). */
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
      if (rem > 0) { const d = Math.ceil(rem / 86_400_000); return { big: String(d), small: `day${d !== 1 ? 's' : ''} left 🌿` }; }
      return { big: '', small: 'Trip complete 🌿' };
    }
    const days = Math.floor(diff / 86_400_000);
    return { big: String(days), small: `day${days !== 1 ? 's' : ''} to go` };
  });

  // ── At a glance ────────────────────────────────────────────────────────────
  /** Next upcoming itinerary event (or the first one). */
  readonly firstUp = computed(() => {
    const items = [...this.itineraryService.items()];
    if (!items.length) return null;
    items.sort((a, b) => a.date === b.date ? a.sortOrder - b.sortOrder : a.date.localeCompare(b.date));
    const today = new Date(this.now()).toISOString().slice(0, 10);
    return items.find(i => i.date >= today) ?? items[0];
  });

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

  readonly weatherGlance = computed(() => {
    const t = this.activeTrip();
    if (!t) return null;
    const w = this.weatherService.weather();
    return w[t.startDate] ?? Object.values(w)[0] ?? null;
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
    if (uid) this.tripService.getUserTrips(uid).then(list => this.trips.set(list.filter(t => !t.archived)));
  }

  ngOnDestroy(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }
}
