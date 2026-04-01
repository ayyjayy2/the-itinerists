import { Injectable } from '@angular/core';
import { Flight } from '../models/trip.models';

// UTC offsets for common US airports (after DST springs forward in March)
const AIRPORT_UTC_OFFSET: Record<string, number> = {
  'SAV': -4,  // EDT  — Savannah/Hilton Head
  'ATL': -4,  // EDT  — Atlanta
  'CLT': -4,  // EDT  — Charlotte
  'IAD': -4,  // EDT  — Washington Dulles
  'DCA': -4,  // EDT  — Reagan National
  'JFK': -4,  // EDT  — New York JFK
  'LGA': -4,  // EDT  — LaGuardia
  'BOS': -4,  // EDT  — Boston
  'RDU': -4,  // EDT  — Raleigh-Durham
  'MIA': -4,  // EDT  — Miami
  'MCO': -4,  // EDT  — Orlando
  'TPA': -4,  // EDT  — Tampa
  'ORD': -5,  // CDT  — Chicago O'Hare
  'MDW': -5,  // CDT  — Chicago Midway
  'BNA': -5,  // CDT  — Nashville
  'MSP': -5,  // CDT  — Minneapolis
  'DFW': -5,  // CDT  — Dallas
  'IAH': -5,  // CDT  — Houston Intercontinental
  'STL': -5,  // CDT  — St. Louis
  'DEN': -6,  // MDT  — Denver
  'PHX': -7,  // MST  — Phoenix (no DST)
  'LAX': -7,  // PDT  — Los Angeles
  'SFO': -7,  // PDT  — San Francisco
  'SEA': -7,  // PDT  — Seattle
};

@Injectable({ providedIn: 'root' })
export class FlightCountdownService {

  /** Returns a live countdown string for the given user based on their ARRIVALS flights. */
  getCountdown(name: string, flights: Flight[]): string {
    const mine = flights.filter(
      f => f.section === 'ARRIVALS' && this.matchesFlightPerson(f.person, name)
    );
    if (!mine.length) return '';

    const sorted   = [...mine].sort((a, b) => a.departureDate.localeCompare(b.departureDate));
    const firstLeg = sorted[0];
    const lastLeg  = sorted[sorted.length - 1];

    const depMs = this.parseToUtcMs(firstLeg.departureDate, firstLeg.departureTime, firstLeg.from);
    const arrMs = this.parseToUtcMs(lastLeg.arrivalDate,    lastLeg.arrivalTime,    lastLeg.to);

    if (isNaN(depMs) || isNaN(arrMs)) return '';

    const now = Date.now();
    if (now >= arrMs) return ''; // trip-live state owned by tripConfig countdown
    if (now >= depMs) return '✈️ In the air!';

    const diff  = depMs - now;
    const days  = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const mins  = Math.floor((diff % 3_600_000)  / 60_000);

    if (days  > 0) return `✈️ ${days}d ${hours}h until departure`;
    if (hours > 0) return `✈️ ${hours}h ${mins}m until departure`;
    return `✈️ ${mins}m until departure`;
  }

  /** Fuzzy match: handles "Maddie" → Madeleine, "Makaela & Dad" → Dad, etc.
   *  Splits person field on /, &, comma, whitespace and checks first-3-char prefix. */
  matchesFlightPerson(person: string, name: string): boolean {
    const p = person.toLowerCase();
    const n = name.toLowerCase();
    if (p.includes(n)) return true;
    const tokens = p.split(/[\/,&\s]+/).filter(Boolean);
    if (n.length >= 3) {
      const prefix = n.substring(0, 3);
      if (tokens.some(t => t.startsWith(prefix))) return true;
    }
    return false;
  }

  parseToUtcMs(date: string, time: string, airport: string): number {
    const clean = time.replace(/\s+(CT|ET|PT|MT|IST|CDT|EDT|CST|EST)$/i, '').trim();
    const m = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return NaN;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
    const offset = AIRPORT_UTC_OFFSET[airport] ?? -4; // default EDT
    const [y, mo, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h - offset, min)).getTime();
  }
}
