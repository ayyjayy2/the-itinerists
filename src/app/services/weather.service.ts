import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2)  return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 86) return '🌦️';
  return '⛈️';
}

export interface LiveWeather {
  city: string;
  minF: number;
  maxF: number;
  code: number;
}

const CACHE_PREFIX  = 'tripplanner_weather_v3_';
const FORECAST_DAYS = 16;

/** Cache is valid until the next 07:00 UTC after it was saved (a rough daily TTL). */
function isCacheValid(timestamp: string): boolean {
  const fetchedAt = new Date(timestamp);
  const now = new Date();
  const next = new Date(fetchedAt);
  next.setUTCHours(7, 0, 0, 0);
  if (next <= fetchedAt) next.setUTCDate(next.getUTCDate() + 1);
  return now < next;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private http = inject(HttpClient);
  private _weather = signal<Record<string, LiveWeather>>({});
  readonly weather = this._weather.asReadonly();
  private loadedFor: string | null = null;

  /**
   * Load the forecast for a single destination + date range. Kept for
   * back-compat; delegates to loadMany with one leg.
   */
  load(startDate?: string, endDate?: string, destination?: string): void {
    if (!startDate || !endDate || !destination?.trim()) return;
    this.loadMany([{ destination, startDate, endDate }]);
  }

  /**
   * Load forecasts for every destination leg of a trip, merging them into one
   * date-keyed map. Because legs cover distinct date ranges, each date resolves
   * to its own leg's city — so the Home glance and per-day outfits show the
   * right location for the right days on a multi-destination trip.
   * No-ops when the set of legs is unchanged.
   */
  loadMany(legs: { destination?: string; startDate?: string; endDate?: string }[]): void {
    const cleaned = legs
      .map(l => ({ destination: l.destination?.trim() ?? '', startDate: l.startDate ?? '', endDate: l.endDate ?? '' }))
      .filter(l => l.destination && l.startDate && l.endDate);
    if (!cleaned.length) return;

    const comboKey = cleaned.map(l => `${l.destination}|${l.startDate}|${l.endDate}`).join('~');
    if (this.loadedFor === comboKey) return;
    this.loadedFor = comboKey;

    // Clear the previous trip's data, then merge each leg in as it resolves.
    this._weather.set({});
    for (const leg of cleaned) this.loadLeg(leg.destination, leg.startDate, leg.endDate);
  }

  /** Load one leg, merging its days into the shared weather map. */
  private loadLeg(dest: string, startDate: string, endDate: string): void {
    // Open-Meteo free tier: 16-day forecast only. Skip legs too far out.
    const today       = new Date();
    const maxForecast = new Date(today);
    maxForecast.setDate(today.getDate() + FORECAST_DAYS);
    const tripStart = new Date(startDate + 'T00:00');
    if (tripStart > maxForecast) return;

    // Clamp the end date to the forecast window.
    const tripEnd  = new Date(endDate + 'T00:00');
    const fetchEnd = tripEnd > maxForecast ? maxForecast.toISOString().slice(0, 10) : endDate;

    // Serve cached data (keyed by destination + range) if still fresh.
    const cacheKey = CACHE_PREFIX + `${dest}|${startDate}|${endDate}`;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const { data, timestamp } = JSON.parse(raw) as { data: Record<string, LiveWeather>; timestamp: string };
        if (isCacheValid(timestamp)) { this._weather.update(prev => ({ ...prev, ...data })); return; }
      }
    } catch { /* ignore */ }

    void this.fetchForDestination(dest, startDate, fetchEnd, cacheKey);
  }

  private async fetchForDestination(dest: string, startDate: string, endDate: string, cacheKey: string): Promise<void> {
    const place = await this.geocode(dest);
    if (!place) {
      console.warn('[WeatherService] could not geocode destination:', dest);
      this.loadedFor = null; // allow a retry on the next load()/loadMany()
      return;
    }

    const url = `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${place.lat}&longitude=${place.lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
      `&temperature_unit=fahrenheit&timezone=auto` +
      `&start_date=${startDate}&end_date=${endDate}`;

    this.http.get<any>(url).subscribe({
      next: (data) => {
        const results: Record<string, LiveWeather> = {};
        const { time, temperature_2m_max, temperature_2m_min, weather_code } = data.daily;
        (time as string[]).forEach((date, i) => {
          results[date] = {
            city:  place.name,
            minF:  Math.round(temperature_2m_min[i]),
            maxF:  Math.round(temperature_2m_max[i]),
            code:  weather_code[i] as number,
          };
        });
        this._weather.update(prev => ({ ...prev, ...results }));
        try { localStorage.setItem(cacheKey, JSON.stringify({ data: results, timestamp: new Date().toISOString() })); }
        catch { /* storage full */ }
      },
      error: (err) => { console.error('[WeatherService] fetch failed:', err); this.loadedFor = null; }
    });
  }

  /** Resolve a destination string to coordinates + a short display name. */
  private async geocode(dest: string): Promise<{ lat: number; lon: number; name: string } | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(dest)}&format=json&limit=1&accept-language=en`;
      const res = await fetch(url);
      const data = await res.json();
      if (!Array.isArray(data) || !data[0]) return null;
      return {
        lat:  parseFloat(data[0].lat),
        lon:  parseFloat(data[0].lon),
        name: dest.split(',')[0].trim(), // "Tokyo, Japan" → "Tokyo"
      };
    } catch {
      return null;
    }
  }
}
