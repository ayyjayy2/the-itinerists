import { StayLike, stayMomentsFor } from './stay-events';

/**
 * The days the Itinerary and the Map both offer, so the two always match.
 *
 * All: every trip day, plus any other day with a plan or a booking.
 * My Trip: those days from the day you set off (your outbound flight's
 * departure) to the day you leave (your return flight's departure), plus any
 * other day you have plans of your own. Without flights, every day.
 */
export interface TripDayInputs {
  tripDays: string[];                          // the trip's own dates
  plans: { date: string; mine: boolean }[];    // itinerary plans, and whether they're for you
  bookingDates: string[];                      // dates of your flights, rides and stays
  myFlights: { section: string; departureDate: string; arrivalDate: string }[];
  showAll: boolean;
}

export function tripDayList(i: TripDayInputs): string[] {
  const all = [...new Set([...i.tripDays, ...i.plans.map(p => p.date), ...i.bookingDates])].filter(Boolean).sort();
  const outbound = i.myFlights.filter(f => f.section === 'ARRIVALS').map(f => f.departureDate).filter(Boolean).sort();
  const home     = i.myFlights.filter(f => f.section === 'DEPARTURES').map(f => f.departureDate).filter(Boolean).sort();
  const start = outbound[0] ?? '';
  const end   = home[0] ?? '';
  if (i.showAll || (!start && !end)) return all;

  const mine = new Set(i.plans.filter(p => p.mine).map(p => p.date));
  return all.filter(d => mine.has(d) || ((!start || d >= start) && (!end || d <= end)));
}

/**
 * The booking dates both pages count: your flights (the day you land on the
 * way out, the day you take off on the way home, as the Itinerary shows
 * them), check-in and check-out of the stays you're in, and every ride.
 */
export function bookingDatesFor(
  flights: { uid?: string; section: string; departureDate: string; arrivalDate: string }[],
  stays: StayLike[], cars: { company?: string; pickupDate?: string; dropoffDate?: string }[],
  uid: string, name: string,
): string[] {
  const dates: string[] = [];
  for (const f of flights) if (f.uid === uid) dates.push(f.section === 'ARRIVALS' ? f.arrivalDate : f.departureDate);
  for (const m of stayMomentsFor(stays, name)) dates.push(m.date);
  for (const c of cars) if (c.company) dates.push(c.pickupDate ?? '', c.dropoffDate ?? '');
  return dates.filter(Boolean);
}

/** Each YYYY-MM-DD date from start to end, both included, counted in UTC so no time zone shifts it. */
export function everyDay(start: string, end: string): string[] {
  const [y, m, d] = start.split('-').map(Number);
  const days: string[] = [];
  if (!y || !m || !d || !end) return days;
  for (let t = Date.UTC(y, m - 1, d); ; t += 86_400_000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    if (iso > end) return days;
    days.push(iso);
  }
}
