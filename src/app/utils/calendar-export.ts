/**
 * Calendar export: one .ics file with a person's part of a trip, which Apple
 * Calendar and Google Calendar import in one go. Every timed event is written
 * as an exact moment (UTC), worked out from the wall time in the right zone
 * (an item in its stop's zone, a flight's departure in its departure airport's
 * zone and arrival in its arrival airport's), so it lands at the right time
 * wherever the calendar is opened. Pure functions; CalendarExportService
 * gathers the data and hands the file over.
 */
import { AccommodationDoc, FlightDoc, ItineraryItemDoc, RentalCar, TripDoc, TripDestination } from '../models/trip.models';
import { parseTimeString, looksLikeFlight } from './first-up';
import { wallToUtcMs } from './zones';
import { tripDestinations } from './trip-destinations';

export type CalTime = { allDay: true; date: string } | { allDay: false; ms: number };
export interface CalEvent {
  uid: string;
  title: string;
  start: CalTime;
  /** Exclusive end; for all-day events, the day after the last day. */
  end: CalTime;
  location?: string;
  description?: string;
}

const HOUR = 3_600_000;

/** Is this "for" field addressed to `me` ("All", empty, or naming them)? */
export function isForMe(forWho: string | undefined, me: string): boolean {
  const v = (forWho ?? '').trim();
  if (!v || v.toLowerCase() === 'all') return true;
  return v.split(',').map(s => s.trim().toLowerCase()).includes(me.trim().toLowerCase());
}

/** The zone of the stop that covers `dateISO`, else the trip's zone. */
export function zoneOnDate(trip: TripDoc, dateISO: string): string | undefined {
  const legs: TripDestination[] = tripDestinations(trip);
  const leg = legs.find(l => l.startDate <= dateISO && dateISO <= l.endDate);
  return leg?.timeZone ?? trip.timeZone ?? legs[0]?.timeZone;
}

export function addDays(dateISO: string, n: number): string {
  const d = new Date(dateISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A wall time on a date in a zone → an exact moment; null without a usable time. */
function moment(dateISO: string, time: string | undefined, zone: string | undefined): number | null {
  const t = parseTimeString(time);
  if (!t || !dateISO) return null;
  return zone ? wallToUtcMs(dateISO, t.h, t.min, zone) : new Date(`${dateISO}T${String(t.h).padStart(2, '0')}:${String(t.min).padStart(2, '0')}:00`).getTime();
}
const allDay = (date: string): CalTime => ({ allDay: true, date });
const at = (ms: number): CalTime => ({ allDay: false, ms });

export interface ExportInput {
  trip: TripDoc;
  me: { uid: string; name: string };
  items: readonly ItineraryItemDoc[];
  flights: readonly FlightDoc[];
  stays: readonly AccommodationDoc[];
  transport: readonly (RentalCar & { id?: string })[];
  /** IATA code → IANA zone (from the airport table). */
  airportZone: (iata: string) => string | undefined;
}

/** Everything on the trip that is for this person, as calendar events. */
export function tripCalendarEvents(x: ExportInput): CalEvent[] {
  const out: CalEvent[] = [];
  const myFlights = x.flights.filter(f => f.uid === x.me.uid);
  const flightDays = new Set(myFlights.flatMap(f => [f.departureDate, f.arrivalDate]).filter(Boolean));

  // Itinerary: mine, minus hand-typed copies of a real flight on that day.
  for (const it of x.items) {
    if (!isForMe(it.forWho, x.me.name)) continue;
    if (flightDays.has(it.date) && looksLikeFlight({ activity: it.activity, category: it.category } as any)) continue;
    const zone = zoneOnDate(x.trip, it.date);
    const start = moment(it.date, it.time, zone);
    const end = moment(it.date, it.endTime, zone);
    out.push({
      uid: `item-${it.id}`, title: it.activity || 'Plan', location: it.location || undefined,
      description: it.notes || undefined,
      ...(start === null
        ? { start: allDay(it.date), end: allDay(addDays(it.date, 1)) }
        : { start: at(start), end: at(end !== null && end > start ? end : start + HOUR) }),
    });
  }

  // Flights: departure in the departure airport's zone, arrival in the arrival airport's.
  for (const f of myFlights) {
    const dep = moment(f.departureDate, f.departureTime, x.airportZone(f.from) ?? zoneOnDate(x.trip, f.departureDate));
    const arr = moment(f.arrivalDate || f.departureDate, f.arrivalTime, x.airportZone(f.to) ?? zoneOnDate(x.trip, f.arrivalDate || f.departureDate));
    const title = `✈ ${f.from} → ${f.to}${f.flightNumber ? ` · ${f.flightNumber}` : ''}`;
    const description = [f.airline, f.notes].filter(Boolean).join('\n') || undefined;
    out.push(dep === null
      ? { uid: `flight-${f.id}`, title, start: allDay(f.departureDate), end: allDay(addDays(f.departureDate, 1)), description }
      : { uid: `flight-${f.id}`, title, start: at(dep), end: at(arr !== null && arr > dep ? arr : dep + HOUR), location: `${f.from} airport`, description });
  }

  // Stays: one all-day span from check-in through the check-out day.
  for (const s of x.stays) {
    if (!isForMe(s.forWho, x.me.name) || !s.checkIn) continue;
    const times = [s.checkInTime && `Check in ${s.checkInTime}`, s.checkOutTime && `Check out ${s.checkOutTime}`].filter(Boolean).join(' · ');
    out.push({
      uid: `stay-${s.id}`, title: `🛏 ${s.name || 'Stay'}`,
      start: allDay(s.checkIn), end: allDay(addDays(s.checkOut || s.checkIn, 1)),
      location: s.address || undefined,
      description: [times, s.bookingRef && `Booking: ${s.bookingRef}`, s.notes].filter(Boolean).join('\n') || undefined,
    });
  }

  // Transport: pick-up and drop-off, when I'm in it (or nobody is listed).
  x.transport.forEach((c, i) => {
    const people = [c.drivers, c.passengers].filter(Boolean).join(',');
    if (people.trim() && !isForMe(people, x.me.name)) return;
    const what = `${c.company || c.mode || 'Transport'}${c.mode && c.company ? ` (${c.mode})` : ''}`;
    const id = c.id ?? String(i);
    for (const [kind, date, time, place] of [['Pick up', c.pickupDate, c.pickupTime, c.pickupLocation], ['Drop off', c.dropoffDate, c.dropoffTime, c.dropoffLocation]] as const) {
      if (!date) continue;
      const ms = moment(date, time, zoneOnDate(x.trip, date));
      out.push({
        uid: `transport-${id}-${kind === 'Pick up' ? 'pickup' : 'dropoff'}`, title: `🚗 ${kind}: ${what}`,
        location: place || undefined, description: c.confirmationNumber ? `Confirmation: ${c.confirmationNumber}` : undefined,
        ...(ms === null ? { start: allDay(date), end: allDay(addDays(date, 1)) } : { start: at(ms), end: at(ms + HOUR) }),
      });
    }
  });

  return out.sort((a, b) => sortKey(a.start) - sortKey(b.start));
}
const sortKey = (t: CalTime) => (t.allDay ? Date.parse(t.date + 'T00:00:00Z') : t.ms);

// ── iCalendar text (RFC 5545) ─────────────────────────────────────────────────

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const day = (iso: string) => iso.replace(/-/g, '');
const prop = (name: string, t: CalTime) => (t.allDay ? `${name};VALUE=DATE:${day(t.date)}` : `${name}:${utc(t.ms)}`);

/** Lines longer than 75 octets continue on the next line after a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = []; let cur = ''; let n = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (n + b > (parts.length ? 74 : 75)) { parts.push(cur); cur = ''; n = 0; }
    cur += ch; n += b;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

export function buildIcs(calendarName: string, events: readonly CalEvent[], nowMs = Date.now()): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Itinerists//Trip export//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calendarName)}`,
  ];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@theitinerists.com`, `DTSTAMP:${utc(nowMs)}`,
      prop('DTSTART', e.start), prop('DTEND', e.end), `SUMMARY:${esc(e.title)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** "Central America Tour 🗺️✨" → "central-america-tour.ics" */
export function icsFileName(tripName: string): string {
  const slug = tripName.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-');
  return `${slug || 'trip'}.ics`;
}
