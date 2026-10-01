import { FlightMoment } from './flight-events';
import { wallToUtcMs } from './zones';

/** What the home "First up" card needs from a schedule entry. */
export interface FirstUpEntry {
  date: string;      // YYYY-MM-DD
  time: string;      // display string, may be ''
  endTime: string;
  activity: string;
  location: string;
  sortOrder: number;
  category?: string; // e.g. "Transport" — lets a real flight override a hand-typed copy of itself
  zone?: string;     // the zone this entry's time is written in (airport for flights, destination for items)
}

/**
 * True when a manual entry is really a flight typed by hand — a Transport /
 * Travel item, or one whose title reads like flying — so the real flight's
 * time (from the Flights page) should win over it on the same day.
 */
export function looksLikeFlight(e: FirstUpEntry): boolean {
  if (e.category === 'Transport' || e.category === 'Travel') return true;
  return /\b(fly|flight|flying|depart|take ?off|land|landing|arriv|airport)/i.test(e.activity);
}

/** Parses "2:30 PM", "4:20pm", "9 am", "14:30" (trailing TZ ignored) → 24h parts, or null. */
export function parseTimeString(raw?: string): { h: number; min: number } | null {
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

/** Ms after which an entry is considered past: end time, else start, else end-of-day.
 *  Read in `zone` when one is known (the entry's own, else the given default), otherwise
 *  on the phone's clock as before zones existed. */
export function entryCutoffMs(e: { date: string; time: string; endTime: string; zone?: string }, zone?: string): number {
  const z = e.zone ?? zone;
  const t = parseTimeString(e.endTime) ?? parseTimeString(e.time);
  if (z) return t ? wallToUtcMs(e.date, t.h, t.min, z) : wallToUtcMs(e.date, 23, 59, z) + 59_000;
  const [y, m, d] = e.date.split('-').map(Number);
  return t
    ? new Date(y, m - 1, d, t.h, t.min).getTime()
    : new Date(y, m - 1, d, 23, 59, 59).getTime(); // no time set → holds for the whole day
}

/** The instant an entry starts (for ordering two same-day entries that may be in different zones). */
function entryStartMs(e: FirstUpEntry, zone?: string): number {
  const z = e.zone ?? zone;
  const t = parseTimeString(e.time);
  if (!t) return NaN;
  if (z) return wallToUtcMs(e.date, t.h, t.min, z);
  const [y, m, d] = e.date.split('-').map(Number);
  return new Date(y, m - 1, d, t.h, t.min).getTime();
}

/** The manual-items pick, unchanged from the original home-card behavior. */
function pickManual(items: FirstUpEntry[], nowMs: number, zone?: string): FirstUpEntry | null {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) =>
    a.date === b.date ? a.sortOrder - b.sortOrder : a.date.localeCompare(b.date));
  const pick = sorted.find(i => entryCutoffMs(i, zone) >= nowMs) ?? sorted[sorted.length - 1];
  return zone && !pick.zone ? { ...pick, zone } : pick;
}

/** The next flight moment still ahead of `nowMs`, in date-then-time order. */
function pickFlight(moments: FlightMoment[], nowMs: number, zone?: string): FirstUpEntry | null {
  const asEntries: FirstUpEntry[] = moments.map(m => ({
    date: m.date, time: m.time, endTime: '', activity: m.label, location: '', sortOrder: -1, zone: m.zone ?? zone,
  }));
  const minutes = (e: FirstUpEntry) => {
    const t = parseTimeString(e.time);
    return t ? t.h * 60 + t.min : 24 * 60; // untimed flights sort to end of day
  };
  // Order by instant when every moment has a zone (JFK 9:45 PM then LIS 10:30 AM), else by date and wall clock.
  const allZoned = asEntries.every(e => e.zone);
  asEntries.sort((a, b) => allZoned
    ? (entryStartMs(a) || entryCutoffMs(a)) - (entryStartMs(b) || entryCutoffMs(b))
    : a.date.localeCompare(b.date) || minutes(a) - minutes(b));
  return asEntries.find(e => entryCutoffMs(e, zone) >= nowMs) ?? null;
}

/**
 * The next thing on the schedule, merging manual itinerary items with the
 * user's real flights. Flights are authoritative for flight times: a same-day
 * manual entry that is itself a flight (Transport, or titled like one) always
 * loses to the real flight, whatever time was typed. Any other same-day manual
 * event only wins when it starts earlier or has no time (untimed events hold
 * their whole day, as before). Manual events keep their original semantics so
 * nothing shifts for itinerary-only trips.
 */
export function pickFirstUp(
  items: FirstUpEntry[], flights: FlightMoment[], nowMs: number, zone?: string,
): FirstUpEntry | null {
  const manual = pickManual(items, nowMs, zone);
  const flight = pickFlight(flights, nowMs, zone);
  if (!flight) return manual;
  if (!manual) return flight;
  if (entryCutoffMs(manual, zone) < nowMs) return flight; // manual pick is the "all passed" fallback
  if (manual.date !== flight.date) return manual.date < flight.date ? manual : flight;
  if (looksLikeFlight(manual)) return flight; // hand-typed flight: the Flights page time is the truth
  const ms = entryStartMs(manual, zone), fs = entryStartMs(flight, zone);
  if (isNaN(ms) || isNaN(fs)) return manual; // untimed manual holds its day; untimed flight defers
  return fs <= ms ? flight : manual;
}
