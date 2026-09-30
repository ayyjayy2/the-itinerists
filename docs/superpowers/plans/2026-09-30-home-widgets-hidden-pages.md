# Home Widgets + Hidden Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every optional page (except Map) gets a Home "At a glance" widget; hiding a page in Customize Menu removes it from the nav, Home widgets, pin tiles, pin options and Quick Access, and the remaining widgets close the gap.

**Architecture:** All widget selection and data-summary logic lives in a new pure module `src/app/utils/home-widgets.ts` with unit tests (the codebase already does this for `first-up.ts`, `pins.ts`, `nav-order.ts`). `HomeComponent` gets thin `computed` wrappers over that module and renders one `@switch` case per widget inside a two-column grid. Trip Settings grows three toggle rows. No new data fetches, no model or rules changes.

**Tech Stack:** Angular 19 standalone components + signals, Jasmine/Karma (`npm run test:ci`), SCSS.

**Spec:** `docs/superpowers/specs/2026-09-30-home-widgets-hidden-pages-design.md`

---

## File map

| File | Responsibility |
|---|---|
| `src/app/utils/home-widgets.ts` (create) | Widget keys/paths, `isPageHidden`, `visibleWidgetKeys`, and the five pure summarisers (`nextStay`, `nextTransport`, `nextFlight`, `expensesTotalBetween`, `recsGlance`). |
| `src/app/utils/home-widgets.spec.ts` (create) | Unit tests for every export above. |
| `src/app/pages/home/home.component.ts` (modify) | Inject `StaysService`, `RecsService`, `ExpensesService`, `DataService`; add `hidden`, `widgetKeys`, per-widget computeds; filter pins and quick access. |
| `src/app/pages/home/home.component.html` (modify) | Replace the fixed "At a glance" block with the widget grid; filter pin editor, pin tiles, quick access, day-map card. |
| `src/app/pages/home/home.component.scss` (modify) | `.glance-grid` + `.wide`; drop `.glance-2col`. |
| `src/app/pages/home/home.component.spec.ts` (create) | Component tests: hidden page removes widget/pin/quick-access; map hidden removes day-map card. |
| `src/app/pages/trip-settings/trip-settings.component.ts` (modify) | Nine hideable pages. |
| `src/app/pages/trip-settings/trip-settings.component.html` (modify) | New helper copy. |

Hidden-page keys are the route path without the leading slash (`'accommodations'`, `'transportation'`, `'finance'`, `'map'`, `'expenses'`, …), matching `app.component.ts:100` which filters nav by `i.path.slice(1)`.

---

### Task 1: Widget selection helpers (`isPageHidden`, `visibleWidgetKeys`)

**Files:**
- Create: `src/app/utils/home-widgets.ts`
- Create: `src/app/utils/home-widgets.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/utils/home-widgets.spec.ts
import { isPageHidden, visibleWidgetKeys, WIDGET_PATHS } from './home-widgets';

describe('home-widgets: isPageHidden', () => {
  it('matches a path against the hidden keys (no leading slash)', () => {
    expect(isPageHidden('/finance', ['finance'])).toBeTrue();
    expect(isPageHidden('/finance', ['map'])).toBeFalse();
    expect(isPageHidden('/accommodations', ['accommodations'])).toBeTrue();
  });
  it('is false for an empty hidden list', () => {
    expect(isPageHidden('/map', [])).toBeFalse();
  });
});

describe('home-widgets: visibleWidgetKeys', () => {
  it('returns every widget in default nav order when nothing is hidden', () => {
    expect(visibleWidgetKeys(undefined, [])).toEqual([
      'itinerary', 'finance', 'packing', 'flights', 'accommodations',
      'transportation', 'expenses', 'recs', 'outfits',
    ]);
  });
  it('drops hidden pages and closes the gap', () => {
    expect(visibleWidgetKeys(undefined, ['finance', 'transportation', 'map'])).toEqual([
      'itinerary', 'packing', 'flights', 'accommodations', 'expenses', 'recs', 'outfits',
    ]);
  });
  it('follows the personal nav order but keeps itinerary first', () => {
    const order = ['/recs', '/packing', '/itinerary', '/finance'];
    expect(visibleWidgetKeys(order, [])).toEqual([
      'itinerary', 'recs', 'packing', 'finance', 'flights', 'accommodations',
      'transportation', 'expenses', 'outfits',
    ]);
  });
  it('never includes map', () => {
    expect(visibleWidgetKeys(['/map'], [])).not.toContain('map' as never);
    expect(Object.keys(WIDGET_PATHS)).not.toContain('map');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:ci -- --include='src/app/utils/home-widgets.spec.ts'`
Expected: compile error, `Cannot find module './home-widgets'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/app/utils/home-widgets.ts
import { applyNavOrder } from './nav-order';

/**
 * Home "At a glance" widgets — one per optional page (Map has none: the
 * day-map card covers it). Pure helpers so the Home component stays thin
 * and everything here is unit-testable without Angular.
 */
export type WidgetKey =
  | 'itinerary' | 'finance' | 'packing' | 'flights' | 'accommodations'
  | 'transportation' | 'expenses' | 'recs' | 'outfits';

/** Default order = the shell's base nav order (app.component.ts). */
export const WIDGET_PATHS: Record<WidgetKey, string> = {
  itinerary:      '/itinerary',
  finance:        '/finance',
  packing:        '/packing',
  flights:        '/flights',
  accommodations: '/accommodations',
  transportation: '/transportation',
  expenses:       '/expenses',
  recs:           '/recs',
  outfits:        '/outfits',
};

/** Hidden-page keys are route paths without the slash (members/{uid}.hiddenPages). */
export function isPageHidden(path: string, hidden: readonly string[]): boolean {
  return hidden.includes(path.replace(/^\//, ''));
}

/**
 * Widgets to render, in the user's personal nav order, minus hidden pages.
 * Itinerary always leads because it is the one page that can't be hidden.
 */
export function visibleWidgetKeys(
  navOrder: readonly string[] | undefined, hidden: readonly string[],
): WidgetKey[] {
  const all = (Object.keys(WIDGET_PATHS) as WidgetKey[]).map(key => ({ key, path: WIDGET_PATHS[key] }));
  const ordered = applyNavOrder(all, navOrder).filter(w => !isPageHidden(w.path, hidden));
  const itin = ordered.filter(w => w.key === 'itinerary');
  const rest = ordered.filter(w => w.key !== 'itinerary');
  return [...itin, ...rest].map(w => w.key);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:ci -- --include='src/app/utils/home-widgets.spec.ts'`
Expected: `TOTAL: 6 SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add src/app/utils/home-widgets.ts src/app/utils/home-widgets.spec.ts
git commit -m "feat(home): widget key selection honours nav order and hidden pages

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Data summarisers (`nextStay`, `nextTransport`, `nextFlight`, `expensesTotalBetween`, `recsGlance`)

**Files:**
- Modify: `src/app/utils/home-widgets.ts`
- Modify: `src/app/utils/home-widgets.spec.ts`

- [ ] **Step 1: Append the failing tests**

```ts
// append to src/app/utils/home-widgets.spec.ts
import {
  nextStay, nextTransport, nextFlight, expensesTotalBetween, recsGlance,
} from './home-widgets';
import { AccommodationDoc, RentalCar, RecDoc, Expense } from '../models/trip.models';
import { FlightMoment } from './flight-events';

const stay = (o: Partial<AccommodationDoc>): AccommodationDoc => ({
  id: 's', name: 'Hotel', address: '', checkIn: '2026-10-03', checkOut: '2026-10-05',
  notes: '', bookingRef: '', forWho: 'All', addedByUid: 'u', createdAt: 0, ...o,
});
const car = (o: Partial<RentalCar>): RentalCar => ({
  company: 'Hertz', confirmationNumber: '', pickupDate: '2026-10-03', pickupTime: '10:00',
  pickupLocation: '', dropoffDate: '2026-10-08', dropoffTime: '09:00', dropoffLocation: '',
  drivers: '', notes: '', ...o,
});
const moment = (o: Partial<FlightMoment>): FlightMoment => ({
  date: '2026-10-03', time: '10:40', label: 'Depart from SAV', kind: 'depart', section: 'DEPARTURES', ...o,
});
const exp = (date: string, amount: number): Expense =>
  ({ id: date + amount, date, description: '', amount, currency: 'USD', category: 'other' });
const rec = (title: string, createdAt: number): RecDoc =>
  ({ id: title, category: 'Food', title, description: '', extra: '', addedByUid: 'u', createdAt });

describe('home-widgets: nextStay', () => {
  it('returns tonight when today is inside a stay', () => {
    const r = nextStay([stay({ name: 'Adlon' })], '2026-10-04');
    expect(r).toEqual(jasmine.objectContaining({ kind: 'tonight' }));
    expect(r!.stay.name).toBe('Adlon');
  });
  it('check-out day is not a night there', () => {
    expect(nextStay([stay({})], '2026-10-05')).toBeNull();
  });
  it('returns the earliest upcoming check-in otherwise', () => {
    const r = nextStay([stay({ name: 'Late', checkIn: '2026-10-10', checkOut: '2026-10-12' }),
                        stay({ name: 'Soon', checkIn: '2026-10-06', checkOut: '2026-10-07' })], '2026-10-01');
    expect(r!.kind).toBe('next');
    expect(r!.stay.name).toBe('Soon');
  });
  it('is null with no stays or only past stays', () => {
    expect(nextStay([], '2026-10-01')).toBeNull();
    expect(nextStay([stay({})], '2026-11-01')).toBeNull();
  });
});

describe('home-widgets: nextTransport', () => {
  it('picks the earliest pick-up or drop-off on or after today', () => {
    const r = nextTransport([car({})], '2026-10-01');
    expect(r).toEqual(jasmine.objectContaining({ kind: 'pickup', date: '2026-10-03', time: '10:00', company: 'Hertz' }));
  });
  it('rolls to the drop-off once the pick-up has passed', () => {
    const r = nextTransport([car({})], '2026-10-04');
    expect(r).toEqual(jasmine.objectContaining({ kind: 'dropoff', date: '2026-10-08' }));
  });
  it('carries the mode, defaulting to Rental Car', () => {
    expect(nextTransport([car({})], '2026-10-01')!.mode).toBe('Rental Car');
    expect(nextTransport([car({ mode: 'Train', company: 'DB' })], '2026-10-01')!.mode).toBe('Train');
  });
  it('is null with nothing upcoming', () => {
    expect(nextTransport([], '2026-10-01')).toBeNull();
    expect(nextTransport([car({})], '2026-10-09')).toBeNull();
  });
});

describe('home-widgets: nextFlight', () => {
  it('returns the soonest moment on or after today with the day count', () => {
    const r = nextFlight([moment({ date: '2026-10-05' }), moment({ date: '2026-10-03' })], '2026-10-01');
    expect(r!.moment.date).toBe('2026-10-03');
    expect(r!.inDays).toBe(2);
  });
  it('orders same-day moments by time', () => {
    const r = nextFlight([moment({ time: '3:00 PM' }), moment({ time: '10:40 AM', label: 'first' })], '2026-10-03');
    expect(r!.moment.label).toBe('first');
    expect(r!.inDays).toBe(0);
  });
  it('is null with no upcoming moments', () => {
    expect(nextFlight([], '2026-10-01')).toBeNull();
    expect(nextFlight([moment({})], '2026-10-04')).toBeNull();
  });
});

describe('home-widgets: expensesTotalBetween', () => {
  it('sums expenses dated inside the trip window, inclusive', () => {
    const list = [exp('2026-10-01', 10), exp('2026-10-03', 20), exp('2026-10-09', 40), exp('2026-09-30', 80)];
    expect(expensesTotalBetween(list, '2026-10-01', '2026-10-09')).toBe(70);
  });
  it('sums everything when the trip has no dates', () => {
    expect(expensesTotalBetween([exp('2026-01-01', 5), exp('2027-01-01', 6)], '', '')).toBe(11);
  });
});

describe('home-widgets: recsGlance', () => {
  it('counts recs and names the newest', () => {
    expect(recsGlance([rec('Old', 1), rec('New', 9), rec('Mid', 5)])).toEqual({ count: 3, latest: 'New' });
  });
  it('is zero/empty with no recs', () => {
    expect(recsGlance([])).toEqual({ count: 0, latest: '' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:ci -- --include='src/app/utils/home-widgets.spec.ts'`
Expected: compile errors, `Module './home-widgets' has no exported member 'nextStay'` (and the other four).

- [ ] **Step 3: Append the implementation**

```ts
// append to src/app/utils/home-widgets.ts
import { AccommodationDoc, RentalCar, RecDoc, Expense } from '../models/trip.models';
import { FlightMoment } from './flight-events';
import { normalizeTime } from './time-format';

// ── Stays ─────────────────────────────────────────────────────────────────────
export interface StayGlance { kind: 'tonight' | 'next'; stay: AccommodationDoc; }

/** Where you sleep tonight (checkIn ≤ today < checkOut), else the next check-in. */
export function nextStay(stays: readonly AccommodationDoc[], todayISO: string): StayGlance | null {
  const tonight = stays.find(s => s.checkIn && s.checkOut && s.checkIn <= todayISO && todayISO < s.checkOut);
  if (tonight) return { kind: 'tonight', stay: tonight };
  const upcoming = stays.filter(s => s.checkIn && s.checkIn >= todayISO)
                        .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return upcoming.length ? { kind: 'next', stay: upcoming[0] } : null;
}

// ── Transportation ────────────────────────────────────────────────────────────
export interface TransportGlance {
  kind: 'pickup' | 'dropoff'; date: string; time: string; company: string; mode: string;
}

/** The next pick-up or drop-off on or after today, across every booking. */
export function nextTransport(cars: readonly RentalCar[], todayISO: string): TransportGlance | null {
  const moments: TransportGlance[] = [];
  for (const c of cars) {
    const mode = c.mode ?? 'Rental Car';
    if (c.pickupDate)  moments.push({ kind: 'pickup',  date: c.pickupDate,  time: c.pickupTime  ?? '', company: c.company, mode });
    if (c.dropoffDate) moments.push({ kind: 'dropoff', date: c.dropoffDate, time: c.dropoffTime ?? '', company: c.company, mode });
  }
  return earliest(moments.filter(m => m.date >= todayISO));
}

// ── Flights ───────────────────────────────────────────────────────────────────
export interface FlightGlance { moment: FlightMoment; inDays: number; }

/** The soonest depart/arrive moment on or after today, and how many days away it is. */
export function nextFlight(moments: readonly FlightMoment[], todayISO: string): FlightGlance | null {
  const m = earliest(moments.filter(x => x.date >= todayISO));
  return m ? { moment: m, inDays: daysBetween(todayISO, m.date) } : null;
}

// ── My Expenses ───────────────────────────────────────────────────────────────
/** Private expenses are one list across trips; scope by the trip's dates when it has them. */
export function expensesTotalBetween(expenses: readonly Expense[], start: string, end: string): number {
  return expenses
    .filter(e => !start || !end || (e.date >= start && e.date <= end))
    .reduce((sum, e) => sum + (e.amount || 0), 0);
}

// ── Recs ──────────────────────────────────────────────────────────────────────
export function recsGlance(recs: readonly RecDoc[]): { count: number; latest: string } {
  if (!recs.length) return { count: 0, latest: '' };
  const newest = [...recs].sort((a, b) => b.createdAt - a.createdAt)[0];
  return { count: recs.length, latest: newest.title };
}

// ── shared ────────────────────────────────────────────────────────────────────
/** Earliest by ISO date, then by 24h time ('' sorts first, i.e. all-day). */
function earliest<T extends { date: string; time: string }>(list: T[]): T | null {
  if (!list.length) return null;
  return [...list].sort((a, b) =>
    a.date.localeCompare(b.date) || sortableTime(a.time).localeCompare(sortableTime(b.time)))[0];
}

/** "3:00 PM" / "15:00" / "" → "15:00" / "" for string comparison. */
function sortableTime(t: string): string {
  const n = normalizeTime(t);           // "3:00 PM" → "3:00 PM" (12h, as the app shows it)
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(n.trim());
  if (!m) return t;
  let h = Number(m[1]);
  const ap = m[3]?.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + 'T00:00:00').getTime();
  const b = new Date(toISO   + 'T00:00:00').getTime();
  return Math.round((b - a) / 86_400_000);
}
```

> Note for the implementer: check `normalizeTime` in `src/app/utils/time-format.ts` before relying on it. If it returns 24h strings ("15:00"), `sortableTime` still works because the regex accepts both forms. If it throws on `''`, guard with `if (!t) return '';` at the top of `sortableTime`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:ci -- --include='src/app/utils/home-widgets.spec.ts'`
Expected: `TOTAL: 20 SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add src/app/utils/home-widgets.ts src/app/utils/home-widgets.spec.ts
git commit -m "feat(home): pure summarisers for stays, transport, flights, expenses and recs widgets

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Customize Menu — nine hideable pages

**Files:**
- Modify: `src/app/pages/trip-settings/trip-settings.component.ts:65-73`
- Modify: `src/app/pages/trip-settings/trip-settings.component.html:181`

No component spec exists for Trip Settings and the toggle logic (`togglePage`) is unchanged; the behaviour is covered by the existing shell nav-filter test in `app.component.spec.ts` (`hiddenPages.set(['outfits'])`) which is key-agnostic.

- [ ] **Step 1: Replace the hideable list**

In `src/app/pages/trip-settings/trip-settings.component.ts`, replace the `hideablePages` array with:

```ts
  /** Pages a member may hide from their own menu and Home widgets on this
   *  trip. Home, Itinerary, My Trips, Trip Settings and Profile stay. Keys are
   *  route paths without the slash (see app.component.ts nav filter). */
  readonly hideablePages: HideablePage[] = [
    { key: 'flights',        label: 'Flights',        icon: 'flights' },
    { key: 'accommodations', label: 'Stays',          icon: 'stays' },
    { key: 'transportation', label: 'Transportation', icon: 'car' },
    { key: 'finance',        label: 'Finance',        icon: 'finance' },
    { key: 'expenses',       label: 'My Expenses',    icon: 'expenses' },
    { key: 'recs',           label: 'Recs',           icon: 'recs' },
    { key: 'packing',        label: 'Packing',        icon: 'packing' },
    { key: 'outfits',        label: 'Outfits',        icon: 'outfits' },
    { key: 'map',            label: 'Map',            icon: 'map' },
  ];
```

- [ ] **Step 2: Update the helper copy**

In `src/app/pages/trip-settings/trip-settings.component.html`, replace the `<p class="muted">` under `<h2>Customize Menu</h2>` with:

```html
      <p class="muted">Hide pages you don't use. Home and Itinerary always stay. This only affects your menu and Home on this trip.</p>
```

- [ ] **Step 3: Build to verify**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: build succeeds, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/trip-settings/trip-settings.component.ts src/app/pages/trip-settings/trip-settings.component.html
git commit -m "feat(settings): Finance, Transportation and Map can be hidden from the menu

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Home component — hidden-aware pins, quick access, widget computeds

**Files:**
- Modify: `src/app/pages/home/home.component.ts`

- [ ] **Step 1: Add imports**

At the top of `src/app/pages/home/home.component.ts`, add after the existing service imports:

```ts
import { StaysService } from '../../services/stays.service';
import { RecsService } from '../../services/recs.service';
import { ExpensesService } from '../../services/expenses.service';
import { DataService } from '../../services/data.service';
import {
  WidgetKey, isPageHidden, visibleWidgetKeys,
  nextStay, nextTransport, nextFlight, expensesTotalBetween, recsGlance,
} from '../../utils/home-widgets';
```

- [ ] **Step 2: Inject the four services**

After `weatherService   = inject(WeatherService);` add:

```ts
  staysService     = inject(StaysService);
  recsService      = inject(RecsService);
  expensesService  = inject(ExpensesService);
  dataService      = inject(DataService);
```

- [ ] **Step 3: Add the hidden set and filtered lists**

Directly after `readonly layout = computed(...)` add:

```ts
  // ── Hidden pages (per member, per trip — Customize Menu in Trip Settings) ──
  readonly hidden = this.tripService.hiddenPages;
  hiddenPage(path: string): boolean { return isPageHidden(path, this.hidden()); }

  /** Which glance widgets to show, in the user's nav order, minus hidden pages. */
  readonly widgetKeys = computed<WidgetKey[]>(() =>
    visibleWidgetKeys(this.userService.firestoreUser()?.navOrder, this.hidden()));

  /** Type B quick-access cards, minus hidden pages. */
  readonly quickAccessVisible = computed(() =>
    this.quickAccess.filter(l => !isPageHidden(l.path, this.hidden())));
```

> `quickAccess` is declared below `layout` in the file today; move the `quickAccess` array above this block so it is initialised first (class fields initialise in order).

- [ ] **Step 4: Filter pins**

Replace the `pinnedTiles` computed with:

```ts
  /** Pin options offered in the editor: hidden pages are left out. */
  readonly pinOptions = computed(() =>
    this.pinnablePages.filter(p => !isPageHidden(p.path, this.hidden())));
  /** Saved pins that are visible on this trip. The saved list itself is not
   *  touched: pins are account data and the page may be shown on other trips. */
  readonly pinnedTiles = computed(() => {
    const set = new Set(this.pins());
    return this.pinOptions().filter(p => set.has(p.path));
  });
```

- [ ] **Step 5: Add the per-widget computeds**

After the `glanceLegShort` computed (end of the "At a glance" section) add:

```ts
  /** Local calendar date for "today" comparisons (YYYY-MM-DD). */
  private readonly todayISO = computed(() => localTodayISO(new Date(this.now())));

  // ── New widgets ────────────────────────────────────────────────────────────
  readonly stayGlance = computed(() => nextStay(this.staysService.stays(), this.todayISO()));

  readonly transportGlance = computed(() =>
    nextTransport(this.dataService.data()?.rentalCar ?? [], this.todayISO()));

  readonly flightGlance = computed(() => {
    const uid  = this.currentUser()?.uid ?? '';
    const dest = this.activeTrip()?.destination ?? 'your destination';
    return nextFlight(flightMomentsForUid(this.flightsService.flights(), uid, dest), this.todayISO());
  });

  /** "Departs in 3 days" / "Lands today". */
  readonly flightGlanceTitle = computed(() => {
    const g = this.flightGlance();
    if (!g) return '';
    const verb = g.moment.kind === 'depart' ? 'Departs' : 'Lands';
    if (g.inDays <= 0) return `${verb} today`;
    if (g.inDays === 1) return `${verb} tomorrow`;
    return `${verb} in ${g.inDays} days`;
  });

  readonly myExpensesTotal = computed(() => {
    const t = this.activeTrip();
    return expensesTotalBetween(this.expensesService.expenses(), t?.startDate ?? '', t?.endDate ?? '');
  });
  readonly myExpensesCount = computed(() => {
    const t = this.activeTrip();
    const s = t?.startDate ?? '', e = t?.endDate ?? '';
    return this.expensesService.expenses().filter(x => !s || !e || (x.date >= s && x.date <= e)).length;
  });

  readonly recGlance = computed(() => recsGlance(this.recsService.recs()));

  /** "Fri, Oct 3" for widget sub-lines. */
  shortDate(iso: string): string {
    return new Date(iso + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  /** Raw user time → the app's 12h display form; empty stays empty. */
  showTime(t: string): string { return t ? normalizeTime(t) : ''; }
```

- [ ] **Step 6: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | head -20`
Expected: no errors. (If `localTodayISO` is not exported from `utils/trip-destinations`, it is — it is already imported at the top of this file.)

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/home/home.component.ts
git commit -m "feat(home): hidden-aware pins and quick access, computeds for every widget

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Home template — widget grid, filtered pins/quick access, day-map gate

**Files:**
- Modify: `src/app/pages/home/home.component.html:114-224, 243-250`
- Modify: `src/app/pages/home/home.component.scss:239`

- [ ] **Step 1: Pin editor uses `pinOptions()`**

In the pin editor block, change

```html
          @for (p of pinnablePages; track p.path) {
```
to
```html
          @for (p of pinOptions(); track p.path) {
```

- [ ] **Step 2: Replace the "At a glance" body with the widget grid**

Replace everything from `<!-- First up (itinerary) -->` through the closing `</div>` of `<div class="glance-2col">` (the weather + packing block) with:

```html
    <div class="glance-grid">
      @for (key of widgetKeys(); track key) {
        @switch (key) {

          @case ('itinerary') {
            <a class="glance-row wide" routerLink="/itinerary" data-widget="itinerary">
              <span class="glance-ic sage"><app-icon name="itinerary" [size]="22" /></span>
              <span class="glance-body">
                @if (firstUp(); as e) {
                  <span class="glance-title">First up: {{ e.activity }}</span>
                  <span class="glance-sub">{{ firstUpWhen() }}@if (e.location) { · {{ e.location }} }</span>
                } @else {
                  <span class="glance-title">Plan your itinerary</span>
                  <span class="glance-sub">Add your first event, day by day</span>
                }
              </span>
              <span class="glance-arrow">›</span>
            </a>
          }

          @case ('finance') {
            <a class="glance-mini" routerLink="/finance" data-widget="finance">
              <div class="glance-mini-top gold">
                <app-icon name="finance" [size]="18" />
                @if (financeNet() !== null && expenseCount() > 0) {
                  @if (financeNet()! > 0.01)       { <span class="owed">Owed {{ money(financeNet()!) }}</span> }
                  @else if (financeNet()! < -0.01) { <span class="owe">You owe {{ money(-financeNet()!) }}</span> }
                  @else                             { <span>All settled 🎉</span> }
                } @else { <span>Finance</span> }
              </div>
              <div class="glance-mini-sub">
                @if (expenseCount() > 0) { {{ money(trackedTotal()) }} tracked } @else { Who paid &amp; who owes }
              </div>
            </a>
          }

          @case ('packing') {
            <a class="glance-mini" routerLink="/packing" data-widget="packing">
              <div class="glance-mini-top pink">
                <app-icon name="packing" [size]="18" />
                <span>{{ packingSummary().packed }}/{{ packingSummary().total }} packed</span>
              </div>
              @if (nextToPack().length) {
                <div class="glance-mini-sub">
                  @for (label of nextToPack(); track label) { <div class="pack-next">○ {{ label }}</div> }
                </div>
              } @else if (packingSummary().total > 0) {
                <div class="glance-mini-sub">All packed! 🎉</div>
              } @else {
                <div class="glance-mini-sub">Packing list</div>
              }
            </a>
          }

          @case ('outfits') {
            <a class="glance-mini" routerLink="/outfits" data-widget="outfits">
              <div class="glance-mini-top gold">
                <app-icon name="recs" [size]="18" />
                @if (weatherGlance(); as w) { <span>{{ w.minF }}–{{ w.maxF }}°F</span> } @else { <span>Weather</span> }
              </div>
              <div class="glance-mini-sub">
                @if (weatherCondition(); as c) {
                  <div class="wx-cond">{{ c.emoji }} {{ c.label }}</div>
                  <div>{{ glanceLegShort() }} · outfits</div>
                } @else { Forecast nearer the trip }
              </div>
            </a>
          }

          @case ('flights') {
            <a class="glance-mini" routerLink="/flights" data-widget="flights">
              <div class="glance-mini-top sky">
                <app-icon name="flights" [size]="18" />
                <span>{{ flightGlance() ? flightGlanceTitle() : 'Flights' }}</span>
              </div>
              <div class="glance-mini-sub">
                @if (flightGlance(); as g) {
                  {{ g.moment.label }}@if (g.moment.time) { · {{ showTime(g.moment.time) }} }
                } @else { Add your flights }
              </div>
            </a>
          }

          @case ('accommodations') {
            <a class="glance-mini" routerLink="/accommodations" data-widget="accommodations">
              <div class="glance-mini-top lav">
                <app-icon name="stays" [size]="18" />
                @if (stayGlance(); as s) {
                  <span>{{ s.kind === 'tonight' ? 'Tonight: ' + s.stay.name : 'Check in ' + shortDate(s.stay.checkIn) }}</span>
                } @else { <span>Stays</span> }
              </div>
              <div class="glance-mini-sub">
                @if (stayGlance(); as s) {
                  {{ s.kind === 'tonight' ? 'Check out ' + shortDate(s.stay.checkOut) : s.stay.name }}
                } @else { Add where you're staying }
              </div>
            </a>
          }

          @case ('transportation') {
            <a class="glance-mini" routerLink="/transportation" data-widget="transportation">
              <div class="glance-mini-top peach">
                <app-icon name="car" [size]="18" />
                @if (transportGlance(); as t) {
                  <span>{{ t.kind === 'pickup' ? 'Pick-up' : 'Drop-off' }} {{ shortDate(t.date) }}@if (t.time) { · {{ showTime(t.time) }} }</span>
                } @else { <span>Transportation</span> }
              </div>
              <div class="glance-mini-sub">
                @if (transportGlance(); as t) { {{ t.company }} · {{ t.mode }} } @else { Add a rental car }
              </div>
            </a>
          }

          @case ('expenses') {
            <a class="glance-mini" routerLink="/expenses" data-widget="expenses">
              <div class="glance-mini-top pink">
                <app-icon name="expenses" [size]="18" />
                <span>{{ myExpensesCount() > 0 ? money(myExpensesTotal()) + ' spent' : 'My Expenses' }}</span>
              </div>
              <div class="glance-mini-sub">
                @if (myExpensesCount() > 0) { Your private spending } @else { Track your own spending }
              </div>
            </a>
          }

          @case ('recs') {
            <a class="glance-mini" routerLink="/recs" data-widget="recs">
              <div class="glance-mini-top sage">
                <app-icon name="recs" [size]="18" />
                <span>{{ recGlance().count > 0 ? recGlance().count + ' rec' + (recGlance().count === 1 ? '' : 's') : 'Recs' }}</span>
              </div>
              <div class="glance-mini-sub">
                @if (recGlance().count > 0) { Latest: {{ recGlance().latest }} } @else { Save a rec }
              </div>
            </a>
          }

        }
      }
    </div>
```

- [ ] **Step 3: Gate the day-map card on Map not being hidden**

Change

```html
    @if (layout() === 'C') {
      <app-day-map-card />
    }
```
to
```html
    @if (layout() === 'C' && !hiddenPage('/map')) {
      <app-day-map-card />
    }
```

- [ ] **Step 4: Quick Access uses the filtered list**

Change

```html
        @for (link of quickAccess; track link.path) {
```
to
```html
        @for (link of quickAccessVisible(); track link.path) {
```

- [ ] **Step 5: Styles**

In `src/app/pages/home/home.component.scss`, replace the line

```scss
.glance-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
```
with
```scss
// Two columns that reflow as widgets come and go; the itinerary card spans both.
.glance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.glance-grid .wide { grid-column: 1 / -1; margin-bottom: 0; }
```

and extend the colour tones on `.glance-mini-top` (inside `.glance-mini`) so every widget has one:

```scss
    &.gold  { color: var(--accent-dark); }
    &.pink  { color: var(--highlight-dk); }
    &.sage  { color: var(--primary-dark); }
    &.sky   { color: #3f7fbf; }
    &.lav   { color: #7c5cbf; }
    &.peach { color: #c2703a; }
    .owed { color: var(--primary-dark); }
    .owe  { color: var(--danger); }
```

- [ ] **Step 6: Build and eyeball**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: success.

Then `npm start`, sign in, open Home on a trip with data, and confirm: two-column grid, itinerary spans full width, each card shows its fact. Hide Finance in Trip Settings → Customize Menu, return Home: Finance card, pin tile and pin option are gone and the grid has no hole.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/home/home.component.html src/app/pages/home/home.component.scss
git commit -m "feat(home): one glance widget per page, hidden pages drop out and the grid reflows

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Home component spec — hidden pages leave no trace

**Files:**
- Create: `src/app/pages/home/home.component.spec.ts`

- [ ] **Step 1: Write the tests**

```ts
// src/app/pages/home/home.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { Component, signal, WritableSignal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';
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
import { StaysService } from '../../services/stays.service';
import { RecsService } from '../../services/recs.service';
import { ExpensesService } from '../../services/expenses.service';
import { DataService } from '../../services/data.service';

/** The real card boots a map; a stub with the same selector keeps the test cheap. */
@Component({ selector: 'app-day-map-card', template: '<div data-stub="day-map"></div>' })
class StubDayMapCard {}

const trip = {
  id: 't1', name: 'Berlin', destination: 'Berlin, Germany',
  startDate: '2026-10-01', endDate: '2026-10-09', currency: 'EUR', memberCount: 2,
};

describe('HomeComponent (hidden pages)', () => {
  let hidden: WritableSignal<string[]>;
  let firestoreUser: WritableSignal<any>;

  beforeEach(async () => {
    hidden = signal<string[]>([]);
    // homeLayout is honoured only for picker accounts; username 'alayna' is one.
    firestoreUser = signal<any>({ uid: 'me', username: 'alayna', homeLayout: 'C', homePins: ['/finance', '/packing'] });

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: {
          currentUser: signal({ uid: 'me', name: 'Alayna' }), isAdmin: signal(false),
          firestoreUser, updateHomePins: () => Promise.resolve(),
        } },
        { provide: TripService, useValue: {
          activeTrip: signal(trip), ready: signal(true), activeMembers: signal([]),
          hiddenPages: hidden, activeActivity: signal([]),
          getUserTrips: () => Promise.resolve([trip]), switchTrip: () => Promise.resolve(),
        } },
        { provide: TripContextService, useValue: { activeTripId: signal('t1') } },
        { provide: FlightCountdownService, useValue: {} },
        { provide: FlightsService,   useValue: { flights: signal([]), loaded: signal(true) } },
        { provide: ItineraryService, useValue: { items: signal([]), loaded: signal(true) } },
        { provide: FinanceService,   useValue: { entries: signal([]) } },
        { provide: PackingService,   useValue: { items: signal([]) } },
        { provide: WeatherService,   useValue: { weather: signal({}), loadMany: () => {} } },
        { provide: StaysService,     useValue: { stays: signal([]) } },
        { provide: RecsService,      useValue: { recs: signal([]) } },
        { provide: ExpensesService,  useValue: { expenses: signal([]) } },
        { provide: DataService,      useValue: { data: signal(null) } },
      ],
    })
    .overrideComponent(HomeComponent, {
      remove: { imports: [DayMapCardComponent] },
      add:    { imports: [StubDayMapCard] },
    })
    .compileComponents();
  });

  function render() {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    return fixture;
  }
  const widgets = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('[data-widget]')).map(n => n.getAttribute('data-widget'));

  it('shows every widget, itinerary first, when nothing is hidden', () => {
    const el = render().nativeElement as HTMLElement;
    expect(widgets(el)).toEqual([
      'itinerary', 'finance', 'packing', 'flights', 'accommodations',
      'transportation', 'expenses', 'recs', 'outfits',
    ]);
    expect(el.querySelector('[data-stub="day-map"]')).not.toBeNull();
  });

  it('hiding a page removes its widget and closes the gap', () => {
    hidden.set(['finance', 'transportation']);
    const el = render().nativeElement as HTMLElement;
    expect(widgets(el)).toEqual([
      'itinerary', 'packing', 'flights', 'accommodations', 'expenses', 'recs', 'outfits',
    ]);
  });

  it('hiding Map removes the day-map card', () => {
    hidden.set(['map']);
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('[data-stub="day-map"]')).toBeNull();
  });

  it('a hidden page has no pin tile and is not offered in the pin editor', () => {
    hidden.set(['finance']);
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    const tiles = Array.from(el.querySelectorAll('.pin-tile')).map(a => a.textContent?.trim());
    expect(tiles).toEqual(['Packing']);

    fixture.componentInstance.togglePinEdit();
    fixture.detectChanges();
    const options = Array.from(el.querySelectorAll('.pin-opt')).map(b => b.textContent?.replace('✓', '').trim());
    expect(options).not.toContain('Finance');
    expect(options).toContain('Packing');
  });

  it('the Simple layout quick-access grid skips hidden pages', () => {
    firestoreUser.set({ ...firestoreUser(), homeLayout: 'B' });
    hidden.set(['map', 'recs']);
    const el = render().nativeElement as HTMLElement;
    const labels = Array.from(el.querySelectorAll('.link-label')).map(n => n.textContent?.trim());
    expect(labels).toContain('Itinerary');
    expect(labels).not.toContain('Map');
    expect(labels).not.toContain('Recs');
  });

  it('shows a live fact on the new widgets', () => {
    const stays = TestBed.inject(StaysService) as unknown as { stays: WritableSignal<any[]> };
    stays.stays.set([{ id: 's', name: 'Adlon', checkIn: '2000-01-01', checkOut: '2999-01-01' }]);
    const recs = TestBed.inject(RecsService) as unknown as { recs: WritableSignal<any[]> };
    recs.recs.set([{ id: 'r', title: 'Café Einstein', createdAt: 5, category: 'Food' }]);
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('[data-widget="accommodations"]')?.textContent).toContain('Tonight: Adlon');
    expect(el.querySelector('[data-widget="recs"]')?.textContent).toContain('1 rec');
    expect(el.querySelector('[data-widget="recs"]')?.textContent).toContain('Café Einstein');
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `npm run test:ci -- --include='src/app/pages/home/home.component.spec.ts'`
Expected: `TOTAL: 6 SUCCESS`.

If a child component throws on construction (e.g. `LoadingComponent`, `BrandComponent`), stub it the same way as `StubDayMapCard` with a matching selector and add it to the `overrideComponent` remove/add lists. Do not weaken the assertions.

- [ ] **Step 3: Run the whole suite**

Run: `npm run test:ci 2>&1 | tail -5`
Expected: all green, including the existing `app.component.spec.ts` nav-filter tests.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/home/home.component.spec.ts
git commit -m "test(home): hidden pages leave no widget, pin, quick-access card or map

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Docs + PR

**Files:**
- Modify: `docs/app-flow-diagram.html` (already modified on this branch, uncommitted: sign-in/onboarding rewrite)
- Modify: `docs/feature-log.md` (append one line)

- [ ] **Step 1: Feature log line**

Append to `docs/feature-log.md` under the newest section:

```md
- Home: one "At a glance" widget per page (Flights, Stays, Transportation, My Expenses, Recs added). Customize Menu can now hide Finance, Transportation and Map. Hidden pages drop out of Home widgets, pin tiles, pin options and Quick Access; the grid reflows.
```

- [ ] **Step 2: Commit the docs (including the diagram rewrite from earlier)**

```bash
git add docs/feature-log.md docs/app-flow-diagram.html docs/superpowers/plans/2026-09-30-home-widgets-hidden-pages.md
git commit -m "docs: flow diagram matches the current sign-in/onboarding; feature log for home widgets

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 3: Open the PR**

```bash
git push -u origin feat/home-widgets-hidden-pages
gh pr create --title "feat(home): a widget per page, hidden pages vanish from Home" --body "$(cat <<'EOF'
## What
- Customize Menu can now hide Finance, Transportation and Map (nine hideable pages).
- Home "At a glance" is a two-column widget grid with one card per page: Itinerary, Finance, Packing, Outfits, plus new Flights, Stays, Transportation, My Expenses and Recs. Map has no card; the day-map card is hidden when Map is.
- Hiding a page removes its widget, pin tile, pin option and Quick Access card. Saved pins are untouched (they follow the account across trips).

## Tests
- `utils/home-widgets.spec.ts` — selection, ordering, and each summariser.
- `pages/home/home.component.spec.ts` — hidden pages leave no trace on any layout.

Spec: `docs/superpowers/specs/2026-09-30-home-widgets-hidden-pages-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage.** Nine hideable pages → Task 3. Widget per page with live/empty copy → Tasks 4–5. Reflowing two-column grid, itinerary full-width → Task 5 styles. Nav-order-driven order → Task 1 (`visibleWidgetKeys`). Pins filtered but saved list untouched → Task 4 step 4. Quick Access filtered → Task 4 step 3 + Task 5 step 4. Day-map card hidden with Map → Task 5 step 3. Tests → Tasks 1, 2, 6. Nothing in the spec is uncovered.

**Type consistency.** `hidden` / `hiddenPage()` / `widgetKeys()` / `pinOptions()` / `quickAccessVisible()` / `stayGlance()` / `transportGlance()` / `flightGlance()` / `flightGlanceTitle()` / `myExpensesTotal()` / `myExpensesCount()` / `recGlance()` / `shortDate()` / `showTime()` are named identically in Task 4 (TS) and Task 5 (HTML). `data-widget` attribute values equal the `WidgetKey` strings used in Task 1 and asserted in Task 6.

**Known judgement call.** My Expenses is one private list across all trips (`userExpenses/{uid}`), so the widget scopes by the trip's date window. This is documented in `expensesTotalBetween`.
