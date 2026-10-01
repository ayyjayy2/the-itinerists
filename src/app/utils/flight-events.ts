/** The subset of FlightDoc these helpers need (kept structural for easy testing). */
export interface FlightLike {
  uid: string;
  section: 'ARRIVALS' | 'DEPARTURES';
  from: string;
  to: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
}

/**
 * A schedule moment derived from a flight. `time` is the raw user-entered
 * string from the Flights page — the source of truth, shown verbatim.
 */
export interface FlightMoment {
  date: string;
  time: string;
  label: string;
  kind: 'depart' | 'arrive';
  section: 'ARRIVALS' | 'DEPARTURES';
  /** The airport's IANA zone: departure in the departure airport's, arrival in the arrival airport's. */
  zone?: string;
}

/** Every depart/arrive moment for one user's flights, in document order. */
export function flightMomentsForUid(flights: FlightLike[], uid: string, dest: string, zoneFor: (iata: string) => string | undefined = () => undefined): FlightMoment[] {
  const moments: FlightMoment[] = [];
  for (const f of flights) {
    if (f.uid !== uid) continue;
    if (f.departureDate) {
      moments.push({
        date: f.departureDate, time: f.departureTime ?? '',
        label: `Depart from ${f.from}`, kind: 'depart', section: f.section, zone: zoneFor(f.from),
      });
    }
    if (f.arrivalDate) {
      moments.push({
        date: f.arrivalDate, time: f.arrivalTime ?? '',
        label: f.section === 'ARRIVALS' ? `Arrive at ${f.to} – ${dest}` : `Arrive at ${f.to}`,
        kind: 'arrive', section: f.section, zone: zoneFor(f.to),
      });
    }
  }
  return moments;
}

/**
 * The real flight moment a hand-typed itinerary item stands for, if any: a
 * Transport / Travel item, or one titled like flying, on a day the person has
 * a flight. "Land", "arrive" and the like mean the arrival; anything else the
 * departure. The Flights page is the truth, so the item shows that moment's
 * time (in its airport's zone) instead of whatever was typed.
 */
export function mirroredFlightMoment(
  item: { date: string; activity: string; category?: string },
  moments: FlightMoment[],
): FlightMoment | null {
  const flightLike = item.category === 'Transport' || item.category === 'Travel'
    || /\b(fly|flight|flying|depart|take ?off|land|landing|arriv|airport)/i.test(item.activity);
  if (!flightLike) return null;
  const sameDay = moments.filter(m => m.date === item.date);
  if (!sameDay.length) return null;
  const wantsArrival = /\b(land|landing|arriv)/i.test(item.activity);
  return sameDay.find(m => m.kind === (wantsArrival ? 'arrive' : 'depart')) ?? sameDay[0];
}
