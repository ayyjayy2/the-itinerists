import { applyNavOrder } from './nav-order';
import { AccommodationDoc, RentalCar, RecDoc, Expense } from '../models/trip.models';
import { FlightMoment } from './flight-events';
import { normalizeTime } from './time-format';

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

/** The four cards Home shows out of the box (the original "At a glance"). */
export const DEFAULT_WIDGETS: readonly WidgetKey[] = ['itinerary', 'finance', 'packing', 'outfits'];
export const GLANCE_SLOTS = DEFAULT_WIDGETS.length;

/**
 * Widgets to render: the defaults in their fixed order, minus hidden pages,
 * topped up to four from the backups (Flights, Stays, Transportation,
 * My Expenses, Recs) in the user's personal nav order. Backups only appear
 * when a default has been hidden, so Home never grows past four cards.
 */
export function visibleWidgetKeys(
  navOrder: readonly string[] | undefined, hidden: readonly string[],
): WidgetKey[] {
  const visible = (k: WidgetKey) => !isPageHidden(WIDGET_PATHS[k], hidden);
  const defaults = DEFAULT_WIDGETS.filter(visible);
  const backups  = (Object.keys(WIDGET_PATHS) as WidgetKey[])
    .filter(k => !DEFAULT_WIDGETS.includes(k))
    .map(key => ({ key, path: WIDGET_PATHS[key] }));
  const fill = applyNavOrder(backups, navOrder).map(w => w.key).filter(visible);
  return [...defaults, ...fill].slice(0, GLANCE_SLOTS);
}

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
  if (!t) return '';
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(normalizeTime(t).trim());
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
