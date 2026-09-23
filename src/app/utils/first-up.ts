import { FlightMoment } from './flight-events';

/** What the home "First up" card needs from a schedule entry. */
export interface FirstUpEntry {
  date: string;      // YYYY-MM-DD
  time: string;      // display string, may be ''
  endTime: string;
  activity: string;
  location: string;
  sortOrder: number;
  category?: string; // e.g. "Transport" — lets a real flight override a hand-typed copy of itself
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

/** Ms after which an entry is considered past: end time, else start, else end-of-day. */
export function entryCutoffMs(e: { date: string; time: string; endTime: string }): number {
  const [y, m, d] = e.date.split('-').map(Number);
  const t = parseTimeString(e.endTime) ?? parseTimeString(e.time);
  return t
    ? new Date(y, m - 1, d, t.h, t.min).getTime()
    : new Date(y, m - 1, d, 23, 59, 59).getTime(); // no time set → holds for the whole day
}

/** The manual-items pick, unchanged from the original home-card behavior. */
function pickManual(items: FirstUpEntry[], nowMs: number): FirstUpEntry | null {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) =>
    a.date === b.date ? a.sortOrder - b.sortOrder : a.date.localeCompare(b.date));
  return sorted.find(i => entryCutoffMs(i) >= nowMs) ?? sorted[sorted.length - 1];
}

/** The next flight moment still ahead of `nowMs`, in date-then-time order. */
function pickFlight(moments: FlightMoment[], nowMs: number): FirstUpEntry | null {
  const asEntries = moments.map(m => ({
    date: m.date, time: m.time, endTime: '', activity: m.label, location: '', sortOrder: -1,
  }));
  const minutes = (e: FirstUpEntry) => {
    const t = parseTimeString(e.time);
    return t ? t.h * 60 + t.min : 24 * 60; // untimed flights sort to end of day
  };
  asEntries.sort((a, b) => a.date.localeCompare(b.date) || minutes(a) - minutes(b));
  return asEntries.find(e => entryCutoffMs(e) >= nowMs) ?? null;
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
  items: FirstUpEntry[], flights: FlightMoment[], nowMs: number,
): FirstUpEntry | null {
  const manual = pickManual(items, nowMs);
  const flight = pickFlight(flights, nowMs);
  if (!flight) return manual;
  if (!manual) return flight;
  if (entryCutoffMs(manual) < nowMs) return flight; // manual pick is the "all passed" fallback
  if (manual.date !== flight.date) return manual.date < flight.date ? manual : flight;
  if (looksLikeFlight(manual)) return flight; // hand-typed flight: the Flights page time is the truth
  const mt = parseTimeString(manual.time);
  const ft = parseTimeString(flight.time);
  if (!mt || !ft) return manual; // untimed manual holds its day; untimed flight defers
  return ft.h * 60 + ft.min <= mt.h * 60 + mt.min ? flight : manual;
}
