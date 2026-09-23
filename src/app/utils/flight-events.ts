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
}

/** Every depart/arrive moment for one user's flights, in document order. */
export function flightMomentsForUid(flights: FlightLike[], uid: string, dest: string): FlightMoment[] {
  const moments: FlightMoment[] = [];
  for (const f of flights) {
    if (f.uid !== uid) continue;
    if (f.departureDate) {
      moments.push({
        date: f.departureDate, time: f.departureTime ?? '',
        label: `Depart from ${f.from}`, kind: 'depart', section: f.section,
      });
    }
    if (f.arrivalDate) {
      moments.push({
        date: f.arrivalDate, time: f.arrivalTime ?? '',
        label: f.section === 'ARRIVALS' ? `Arrive at ${f.to} – ${dest}` : `Arrive at ${f.to}`,
        kind: 'arrive', section: f.section,
      });
    }
  }
  return moments;
}
