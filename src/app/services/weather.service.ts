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

// Savannah, GA coordinates
const SAVANNAH_LAT = 32.0809;
const SAVANNAH_LON = -81.0912;
const SAVANNAH_TZ  = 'America%2FNew_York';

const CACHE_KEY    = 'tripplanner_weather_v2';
const FORECAST_DAYS = 16;

/** Cache is valid until the next 7 AM ET after it was saved. */
function isCacheValid(timestamp: string): boolean {
  const fetchedAt = new Date(timestamp);
  const now = new Date();
  const next7am = new Date(fetchedAt);
  next7am.setUTCHours(11, 0, 0, 0); // 7 AM ET = 11 AM UTC
  if (next7am <= fetchedAt) next7am.setUTCDate(next7am.getUTCDate() + 1);
  return now < next7am;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private http = inject(HttpClient);
  private _weather = signal<Record<string, LiveWeather>>({});
  readonly weather = this._weather.asReadonly();
  private _loaded = false;

  /** Load Savannah weather for a given date range. No-ops until dates are available. */
  load(startDate?: string, endDate?: string): void {
    if (!startDate || !endDate) return;  // wait until config is ready
    if (this._loaded) return;
    this._loaded = true;

    // Open-Meteo free tier: 16-day forecast only. Skip if trip hasn't entered the window yet.
    const today     = new Date();
    const maxForecast = new Date(today);
    maxForecast.setDate(today.getDate() + FORECAST_DAYS);
    const tripStart = new Date(startDate + 'T00:00');
    if (tripStart > maxForecast) return;  // too far out — no forecast available yet

    // Clamp end date to the forecast window
    const tripEnd    = new Date(endDate + 'T00:00');
    const fetchEnd   = tripEnd > maxForecast ? maxForecast.toISOString().slice(0, 10) : endDate;

    // Return cached data if still valid
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { data, timestamp } = JSON.parse(raw) as { data: Record<string, LiveWeather>; timestamp: string };
        if (isCacheValid(timestamp)) {
          this._weather.set(data);
          return;
        }
      }
    } catch { /* ignore */ }

    const url = `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${SAVANNAH_LAT}&longitude=${SAVANNAH_LON}` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
      `&temperature_unit=fahrenheit&timezone=${SAVANNAH_TZ}` +
      `&start_date=${startDate}&end_date=${fetchEnd}`;

    this.http.get<any>(url).subscribe({
      next: (data) => {
        const results: Record<string, LiveWeather> = {};
        const { time, temperature_2m_max, temperature_2m_min, weather_code } = data.daily;
        (time as string[]).forEach((date, i) => {
          results[date] = {
            city:  'Savannah',
            minF:  Math.round(temperature_2m_min[i]),
            maxF:  Math.round(temperature_2m_max[i]),
            code:  weather_code[i] as number,
          };
        });
        this._weather.set(results);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: results, timestamp: new Date().toISOString() })); }
        catch { /* storage full */ }
      },
      error: (err) => { console.error('[WeatherService] fetch failed:', err); }
    });
  }
}
