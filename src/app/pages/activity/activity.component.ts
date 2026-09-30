import { Component, OnDestroy, computed, effect, inject, signal, Injector, runInInjectionContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, query, where, orderBy, onSnapshot, Timestamp, Unsubscribe } from '@angular/fire/firestore';
import { IconComponent } from '../../shared/icon/icon.component';
import { AvatarGlyphComponent } from '../../shared/avatar-glyph/avatar-glyph.component';
import { UsersService } from '../../services/users.service';
import { TripService } from '../../services/trip.service';
import {
  UsageRow, HourMode, onlineNow, usersPerHour, usersPerDay, hourOfDay, pageStats, peopleStats, dayKey,
} from '../../utils/usage-stats';

type Range = 'today' | '24h' | '7d' | '30d';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Someone with an event this recent is "online": pings arrive every five minutes. */
const ONLINE_WINDOW = 6 * 60_000;

/**
 * Admin-only view of how the app is being used, computed in the browser from
 * the `_activity` events UsageService records. Live: the query is a snapshot
 * listener, so the page moves as people use the app.
 */
@Component({
  selector: 'app-activity',
  imports: [CommonModule, FormsModule, IconComponent, AvatarGlyphComponent],
  templateUrl: './activity.component.html',
  styleUrl: './activity.component.scss',
})
export class ActivityComponent implements OnDestroy {
  private firestore    = inject(Firestore);
  private injector     = inject(Injector);
  private usersService = inject(UsersService);
  private tripService  = inject(TripService);

  readonly viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  // ── controls ──────────────────────────────────────────────────────────────
  range      = signal<Range>('24h');
  tripFilter = signal<string>('all');
  /** 'local' = each person's own clock; otherwise one IANA zone for everyone. */
  hourMode   = signal<HourMode>('local');
  /** Zone used for day boundaries and hour labels. */
  zone       = signal<string>(this.viewerZone);

  // ── data ──────────────────────────────────────────────────────────────────
  private rows    = signal<UsageRow[]>([]);
  loading = signal(true);
  error   = signal('');
  /** Ticks every 30 s so "online now" and "x min ago" stay honest without re-querying. */
  now     = signal(Date.now());
  /** When the range was picked; the query start hangs off this, not the ticking clock. */
  private anchor = signal(Date.now());
  private unsub?: Unsubscribe;
  private ticker = setInterval(() => this.now.set(Date.now()), 30_000);

  /** Where the Firestore query starts for the chosen range. */
  private queryStart = computed(() => {
    const a = this.anchor();
    switch (this.range()) {
      case 'today': return startOfDay(a, this.zone());
      case '24h':   return a - DAY;
      case '7d':    return a - 7 * DAY;
      case '30d':   return a - 30 * DAY;
    }
  });

  constructor() {
    effect(() => {
      const start = this.queryStart();
      this.subscribe(start);
    });
  }

  private subscribe(startMs: number): void {
    this.unsub?.();
    this.loading.set(true);
    this.error.set('');
    runInInjectionContext(this.injector, () => {
      const q = query(
        collection(this.firestore, '_activity'),
        where('at', '>=', Timestamp.fromMillis(startMs)),
        orderBy('at'),
      );
      this.unsub = onSnapshot(q, snap => {
        const rows: UsageRow[] = [];
        for (const d of snap.docs) {
          const e = d.data();
          const at = (e['at'] as Timestamp | null)?.toMillis();
          if (at === undefined) continue; // pending local write, no server time yet
          rows.push({
            uid: e['uid'], tripId: e['tripId'] ?? null, type: e['type'], page: e['page'], at,
            localHour: e['localHour'], tz: e['tz'], tzOffsetMin: e['tzOffsetMin'],
            platform: e['platform'], sessionId: e['sessionId'], appVersion: e['appVersion'],
          });
        }
        this.rows.set(rows);
        this.loading.set(false);
      }, err => {
        this.error.set(err.message);
        this.loading.set(false);
      });
    });
  }

  ngOnDestroy(): void {
    this.unsub?.();
    clearInterval(this.ticker);
  }

  setRange(r: Range): void { this.anchor.set(Date.now()); this.range.set(r); }

  // ── derived ───────────────────────────────────────────────────────────────
  /** Rows narrowed to the chosen trip. */
  private filtered = computed(() => {
    const t = this.tripFilter();
    const rows = this.rows();
    return t === 'all' ? rows : rows.filter(r => r.tripId === t);
  });

  tripOptions = computed(() => {
    const ids = new Set<string>();
    for (const r of this.rows()) if (r.tripId) ids.add(r.tripId);
    const active = this.tripService.activeTrip();
    return [...ids].map(id => ({ id, name: active && active.id === id ? active.name : `Trip …${id.slice(-4)}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  zoneOptions = computed(() => {
    const zones = new Set<string>([this.viewerZone]);
    for (const r of this.rows()) if (r.tz) zones.add(r.tz);
    return [...zones].sort();
  });

  online   = computed(() => onlineNow(this.filtered(), this.now(), ONLINE_WINDOW));
  perHour  = computed(() => {
    const end = Math.ceil(this.now() / HOUR) * HOUR;
    return usersPerHour(this.filtered(), end - DAY, end, this.zone());
  });
  perDay   = computed(() => usersPerDay(this.filtered(), this.zone()));
  byHour   = computed(() => hourOfDay(this.filtered(), this.hourMode()));
  pages    = computed(() => pageStats(this.filtered()));
  people   = computed(() => peopleStats(this.filtered(), this.zone()));

  totals = computed(() => {
    const rows = this.filtered();
    const users = new Set(rows.map(r => r.uid)).size;
    const views = rows.filter(r => r.type === 'page').length;
    const sessions = rows.filter(r => r.type === 'session').length;
    return { users, views, sessions, events: rows.length };
  });

  maxPerHour = computed(() => Math.max(1, ...this.perHour().map(b => b.users)));
  maxPerDay  = computed(() => Math.max(1, ...this.perDay().map(b => b.users)));
  maxByHour  = computed(() => Math.max(1, ...this.byHour()));

  private userMap = computed(() => new Map(this.usersService.allUsers().map(u => [u.uid, u])));

  // ── template helpers ──────────────────────────────────────────────────────
  user(uid: string) { return this.userMap().get(uid); }
  name(uid: string): string { return this.userMap().get(uid)?.displayName ?? `…${uid.slice(-5)}`; }

  ago(ms: number): string {
    const s = Math.max(0, Math.round((this.now() - ms) / 1000));
    if (s < 60) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 48) return `${h} h ago`;
    return `${Math.round(h / 24)} d ago`;
  }

  dayLabel(day: string): string {
    const [y, m, d] = day.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const todayKey = dayKey(this.now(), this.zone());
    if (day === todayKey) return 'Today';
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  hourTick(i: number): string { return i % 6 === 0 ? `${String(i).padStart(2, '0')}` : ''; }

  zoneShort(tz: string): string { return tz.split('/').pop()?.replace(/_/g, ' ') ?? tz; }

  rangeLabel(): string {
    switch (this.range()) {
      case 'today': return 'today';
      case '24h':   return 'the last 24 hours';
      case '7d':    return 'the last 7 days';
      case '30d':   return 'the last 30 days';
    }
  }
}

/** Midnight at the start of the calendar day containing `ms` in `zone`. */
function startOfDay(ms: number, zone: string): number {
  const day = dayKey(ms, zone);
  // Walk back from the instant in whole hours until the day key changes, then step forward.
  let t = ms;
  while (dayKey(t - HOUR, zone) === day) t -= HOUR;
  // t is now inside the first hour of the day; snap to that hour's start.
  return Math.floor(t / HOUR) * HOUR;
}
