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

const CITY_CONFIGS: { city: string; lat: number; lon: number; dates: string[] }[] = [
  { city: 'Belfast',   lat: 54.5973, lon: -5.9301, dates: ['2026-03-13', '2026-03-14'] },
  { city: 'Galway',    lat: 53.2707, lon: -9.0568, dates: ['2026-03-14', '2026-03-15'] },
  { city: 'Dublin',    lat: 53.3498, lon: -6.2603, dates: ['2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-22'] },
  { city: 'Cork',      lat: 51.8985, lon: -8.4756, dates: ['2026-03-19', '2026-03-20'] },
  { city: 'Killarney', lat: 52.0598, lon: -9.5044, dates: ['2026-03-20', '2026-03-21'] },
];

const CACHE_KEY = 'ireland_weather_v1';

/** Cache is valid until the next 7 AM GMT after it was saved. */
function isCacheValid(timestamp: string): boolean {
  const fetchedAt = new Date(timestamp);
  const now = new Date();
  // Find the next 7 AM GMT on or after the fetch time
  const next7am = new Date(fetchedAt);
  next7am.setUTCHours(7, 0, 0, 0);
  if (next7am <= fetchedAt) next7am.setUTCDate(next7am.getUTCDate() + 1);
  return now < next7am;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private http = inject(HttpClient);
  private _weather = signal<Record<string, LiveWeather>>({});
  readonly weather = this._weather.asReadonly();
  private _loaded = false;

  load(): void {
    if (this._loaded) return;
    this._loaded = true;

    // Return cached data if it's still within today's 7 AM GMT window
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { data, timestamp } = JSON.parse(raw) as { data: Record<string, LiveWeather>; timestamp: string };
        if (isCacheValid(timestamp)) {
          this._weather.set(data);
          return;
        }
      }
    } catch { /* ignore parse errors */ }

    // Fetch fresh data and cache it
    const results: Record<string, LiveWeather> = {};
    let pending = CITY_CONFIGS.length;

    for (const cfg of CITY_CONFIGS) {
      const url = `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${cfg.lat}&longitude=${cfg.lon}` +
        `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
        `&temperature_unit=fahrenheit&timezone=Europe%2FLondon` +
        `&start_date=2026-03-13&end_date=2026-03-22`;

      this.http.get<any>(url).subscribe({
        next: (data) => {
          const { time, temperature_2m_max, temperature_2m_min, weathercode } = data.daily;
          (time as string[]).forEach((date, i) => {
            if (cfg.dates.includes(date)) {
              results[`${date}_${cfg.city}`] = {
                city: cfg.city,
                minF: Math.round(temperature_2m_min[i]),
                maxF: Math.round(temperature_2m_max[i]),
                code: weathercode[i] as number,
              };
            }
          });
          this._weather.set({ ...results });
          if (--pending === 0) {
            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: results, timestamp: new Date().toISOString() })); }
            catch { /* storage full — skip caching */ }
          }
        },
        error: () => { if (--pending === 0) { /* all done, some may have failed */ } }
      });
    }
  }
}
