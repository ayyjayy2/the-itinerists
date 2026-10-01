import { Injectable, inject } from '@angular/core';
import tzLookup from 'tz-lookup';
import { TripDestination } from '../models/trip.models';
import { TripService } from './trip.service';

/**
 * One place-name lookup (Nominatim), used to give a trip leg its coordinates
 * and time zone when the owner saves it. The map keeps its own richer geocoder
 * for pins; this one only answers "where is this destination, and what zone".
 */
@Injectable({ providedIn: 'root' })
export class GeocodeService {
  private tripService = inject(TripService);

  /**
   * After a trip is saved: give each leg without a zone its coordinates and
   * IANA zone, then patch the trip. Fire-and-forget; a failed lookup leaves
   * that leg on the phone's clock, as before zones existed.
   */
  async resolveTripZones(tripId: string, destinations: TripDestination[]): Promise<void> {
    const legs = destinations.map(l => ({ ...l }));
    let changed = false;
    for (let i = 0; i < legs.length; i++) {
      if (legs[i].timeZone || !legs[i].destination) continue;
      if (changed) await new Promise(r => setTimeout(r, 1100));   // Nominatim: one request a second
      const hit = await this.locate(legs[i].destination);
      if (!hit) continue;
      legs[i].timeZone = hit.timeZone;
      if (!legs[i].destinationCoords) legs[i].destinationCoords = { lat: hit.lat, lng: hit.lng };
      changed = true;
    }
    if (!changed) return;
    const primary = legs[0];
    await this.tripService.updateTrip(tripId, {
      destinations: legs, timeZone: primary.timeZone, destinationCoords: primary.destinationCoords,
    }).catch(() => { /* next save will try again */ });
  }

  async locate(query: string): Promise<{ lat: number; lng: number; timeZone: string } | null> {
    const q = query.trim();
    if (!q) return null;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!res.ok) return null;
      const hit = (await res.json())[0];
      if (!hit) return null;
      const lat = Number(hit.lat), lng = Number(hit.lon);
      return { lat, lng, timeZone: tzLookup(lat, lng) };
    } catch { return null; }
  }
}
