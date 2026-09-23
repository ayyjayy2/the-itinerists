/** The subset of AccommodationDoc these helpers need (kept structural for easy testing). */
export interface StayLike {
  name: string;
  checkIn: string;        // YYYY-MM-DD
  checkOut: string;
  checkInTime?: string;   // display string as typed on the Stays page, e.g. "3:00 PM"
  checkOutTime?: string;
  forWho: string;         // comma-separated display names or "All"
}

/**
 * A schedule moment derived from a stay. `time` is the raw user-entered
 * string from the Stays page — the source of truth, shown verbatim, or ''.
 */
export interface StayMoment {
  date: string;
  time: string;
  label: string;
  kind: 'check-in' | 'check-out';
}

/** True when `forWho` is "All" or lists `name`. */
function isFor(forWho: string, name: string): boolean {
  return forWho === 'All' || forWho.split(',').map(s => s.trim()).includes(name);
}

/** Check-in / check-out moments for every stay `name` is on, in document order. */
export function stayMomentsFor(stays: StayLike[], name: string): StayMoment[] {
  const moments: StayMoment[] = [];
  for (const s of stays) {
    if (!s.name || !isFor(s.forWho, name)) continue;
    if (s.checkIn) {
      moments.push({ date: s.checkIn, time: s.checkInTime ?? '', label: `Check in: ${s.name}`, kind: 'check-in' });
    }
    if (s.checkOut) {
      moments.push({ date: s.checkOut, time: s.checkOutTime ?? '', label: `Check out: ${s.name}`, kind: 'check-out' });
    }
  }
  return moments;
}
