import { Injectable, inject } from '@angular/core';
import { Flight, FlightDoc } from '../models/trip.models';
import { AirportZoneService } from './airport-zone.service';
import { wallToUtcMs } from '../utils/zones';


@Injectable({ providedIn: 'root' })
export class FlightCountdownService {
  private airportZones = inject(AirportZoneService);

  /** Countdown for the new uid-based FlightDoc collection. */
  getCountdownForUid(uid: string, flights: FlightDoc[]): string {
    const mine = flights.filter(f => f.section === 'ARRIVALS' && f.uid === uid);
    if (!mine.length) return '';

    const sorted   = [...mine].sort((a, b) => a.departureDate.localeCompare(b.departureDate));
    const firstLeg = sorted[0];
    const lastLeg  = sorted[sorted.length - 1];

    const depMs = this.parseToUtcMs(firstLeg.departureDate, firstLeg.departureTime, firstLeg.from);
    const arrMs = this.parseToUtcMs(lastLeg.arrivalDate,    lastLeg.arrivalTime,    lastLeg.to);

    if (isNaN(depMs) || isNaN(arrMs)) return '';

    const now = Date.now();
    if (now >= arrMs) return '';
    if (now >= depMs) return '✈️ In the air!';

    const diff  = depMs - now;
    const days  = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const mins  = Math.floor((diff % 3_600_000)  / 60_000);

    if (days  > 0) return `✈️ ${days}d ${hours}h until departure`;
    if (hours > 0) return `✈️ ${hours}h ${mins}m until departure`;
    return `✈️ ${mins}m until departure`;
  }

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
    if (now >= arrMs) return ''; // trip-live state owned by the home countdown
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

  /** The instant a flight time happens, read in its airport's zone (the phone's zone if the code is unknown). */
  parseToUtcMs(date: string, time: string, airport: string): number {
    const clean = time.replace(/\s+(CT|ET|PT|MT|IST|CDT|EDT|CST|EST|WEST|CEST|BST|GMT)$/i, '').trim();
    const m = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return NaN;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
    const zone = this.airportZones.zoneFor(airport) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    return wallToUtcMs(date, h, min, zone);
  }
}
