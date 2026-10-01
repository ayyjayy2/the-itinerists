import { Injectable, signal } from '@angular/core';

/** [IANA zone, latitude, longitude] per IATA code, as public/data/airports.json stores it. */
type AirportRow = [string, number, number];

/**
 * IATA code → zone and coordinates, from public/data/airports.json (generated
 * by scripts/gen-airports.js). Loaded once, lazily, the first time a flight
 * time needs its zone or the map needs an airport's position; `zones()` is a
 * signal so computeds re-run when it lands.
 */
@Injectable({ providedIn: 'root' })
export class AirportZoneService {
  readonly zones = signal<Record<string, string>>({});
  private rows: Record<string, AirportRow> = {};
  private loading = false;
  private loaded: Promise<void> | null = null;

  /** The zone for an airport code, or undefined while loading / when unknown. Triggers the load. */
  zoneFor(iata: string | undefined): string | undefined {
    if (!iata) return undefined;
    const z = this.zones()[iata.toUpperCase()];
    if (!z && !this.loading) void this.load();
    return z;
  }

  /** The airport's coordinates, once the table has loaded (awaits it). */
  async coordsFor(iata: string | undefined): Promise<{ lat: number; lng: number } | null> {
    if (!iata) return null;
    await this.load();
    const row = this.rows[iata.toUpperCase()];
    return row ? { lat: row[1], lng: row[2] } : null;
  }

  private load(): Promise<void> {
    if (this.loaded) return this.loaded;
    this.loading = true;
    this.loaded = fetch('/data/airports.json').then(r => r.ok ? r.json() : {}).then((map: Record<string, AirportRow>) => {
      this.rows = map;
      this.zones.set(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v[0]])));
    }).catch(() => { /* flights fall back to the trip's zone */ });
    return this.loaded;
  }
}
