import { parseTimeString } from './first-up';

/** A booking's moment on a day: a flight leg, a transport pick-up/drop-off, a stay check-in/out. */
export interface DayBooking {
  kind: 'flight' | 'transport' | 'stay';
  icon: string;
  label: string;
  time: string;
  zoneLabel?: string;
}

export interface BookingSources {
  flights:    { date: string; label: string; time: string; zoneLabel?: string }[];
  transports: { date: string; label: string; time: string; icon: string }[];
  stays:      { date: string; label: string; time: string }[];
}

/**
 * Everything booked on `date`, in time order with untimed moments last. The
 * itinerary's List and Calendar both read the day's bookings from here, so a
 * day with a flight, a train or a check-in never looks empty in either.
 */
export function bookingsOn(date: string, src: BookingSources): DayBooking[] {
  const out: DayBooking[] = [
    ...src.flights.filter(f => f.date === date)
      .map(f => ({ kind: 'flight' as const, icon: 'flights', label: f.label, time: f.time, zoneLabel: f.zoneLabel })),
    ...src.transports.filter(t => t.date === date)
      .map(t => ({ kind: 'transport' as const, icon: t.icon, label: t.label, time: t.time })),
    ...src.stays.filter(s => s.date === date)
      .map(s => ({ kind: 'stay' as const, icon: 'stays', label: s.label, time: s.time })),
  ];
  const minutes = (b: DayBooking) => { const t = parseTimeString(b.time); return t ? t.h * 60 + t.min : Infinity; };
  return out
    .map((b, i) => ({ b, i, m: minutes(b) }))
    .sort((x, y) => (x.m - y.m) || (x.i - y.i))
    .map(({ b }) => b);
}
