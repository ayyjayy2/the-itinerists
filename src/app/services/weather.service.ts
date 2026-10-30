import { Injectable, signal, inject, computed, effect, untracked, Injector, runInInjectionContext } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Firestore, collection, doc, onSnapshot, setDoc, serverTimestamp, Unsubscribe } from '@angular/fire/firestore';
import { WeatherDayDoc } from '../models/trip.models';
import { daysToSave, weatherRequests, WeatherRequest } from '../utils/forecast-window';
import { TripContextService } from './trip-context.service';
import { UserService } from './user.service';

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

const CACHE_PREFIX = 'tripplanner_weather_v4_';

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
  private http        = inject(HttpClient);
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private tripContext = inject(TripContextService);
  private userService = inject(UserService);

  /** The active trip id, only while someone is signed in (rules refuse listeners otherwise). */
  private signedInTripId = computed(() =>
    this.userService.currentUser() ? this.tripContext.activeTripId() : null);

  /** What the weather was on past days, saved to the trip (#558). */
  private _saved = signal<Record<string, LiveWeather>>({});
  private savedLoaded = false;
  /** Days fetched from Open-Meteo this visit: forecasts and unsaved past days. */
  private _fetched = signal<Record<string, LiveWeather>>({});
  /** Every day's weather by date; a saved past day wins over a fetched one. */
  readonly weather = computed(() => ({ ...this._fetched(), ...this._saved() }));

  private savedUnsub?: Unsubscribe;
  private legs: { destination: string; startDate: string; endDate: string }[] = [];
  private loadedFor: string | null = null;

  constructor() {
    effect(() => {
      const tripId = this.signedInTripId();
      untracked(() => this.listenToSaved(tripId));
    });
  }

  private listenToSaved(tripId: string | null): void {
    this.savedUnsub?.(); this.savedUnsub = undefined;
    this._saved.set({});
    this.savedLoaded = !tripId;
    this.loadedFor = null;
    if (!tripId) { this.loadLegs(); return; }
    runInInjectionContext(this.injector, () => {
      this.savedUnsub = onSnapshot(collection(this.firestore, 'trips', tripId, 'weather'), snap => {
        const saved: Record<string, LiveWeather> = {};
        for (const d of snap.docs) {
          const { city, minF, maxF, code } = d.data() as WeatherDayDoc;
          saved[d.id] = { city, minF, maxF, code };
        }
        this._saved.set(saved);
        // Fetch only once we know which past days are saved, so we don't look them up again.
        if (!this.savedLoaded) { this.savedLoaded = true; this.loadLegs(); }
      }, () => { this.savedLoaded = true; this.loadLegs(); });
    });
  }

  /**
   * Load the forecast for a single destination + date range. Kept for
   * back-compat; delegates to loadMany with one leg.
   */
  load(startDate?: string, endDate?: string, destination?: string): void {
    if (!startDate || !endDate || !destination?.trim()) return;
    this.loadMany([{ destination, startDate, endDate }]);
  }

  /**
   * Load the weather for every destination leg of a trip, merging them into one
   * date-keyed map. Because legs cover distinct date ranges, each date resolves
   * to its own leg's city — so the Home glance and per-day outfits show the
   * right location for the right days on a multi-destination trip.
   * No-ops when the set of legs is unchanged.
   */
  loadMany(legs: { destination?: string; startDate?: string; endDate?: string }[]): void {
    this.legs = legs
      .map(l => ({ destination: l.destination?.trim() ?? '', startDate: l.startDate ?? '', endDate: l.endDate ?? '' }))
      .filter(l => l.destination && l.startDate && l.endDate);
    this.loadLegs();
  }

  private loadLegs(): void {
    if (!this.legs.length || !this.savedLoaded) return;
    const comboKey = this.legs.map(l => `${l.destination}|${l.startDate}|${l.endDate}`).join('~');
    if (this.loadedFor === comboKey) return;
    this.loadedFor = comboKey;

    // Clear the previous trip's data, then merge each leg in as it resolves.
    this._fetched.set({});
    const tripId = this.signedInTripId();
    const saved = new Set(Object.keys(this._saved()));
    for (const leg of this.legs) void this.loadLeg(leg.destination, leg.startDate, leg.endDate, saved, tripId);
  }

  /** Load one leg: past days from history (unless saved), today on from the forecast. */
  private async loadLeg(dest: string, startDate: string, endDate: string, saved: ReadonlySet<string>, tripId: string | null): Promise<void> {
    const now = new Date();
    const requests = weatherRequests(startDate, endDate, now, saved);
    if (!requests.length) return;

    let place: { lat: number; lon: number; name: string } | null = null;
    for (const req of requests) {
      // Serve cached data (keyed by source + destination + range) if still fresh.
      const cacheKey = CACHE_PREFIX + `${req.source}|${dest}|${req.start}|${req.end}`;
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const { data, timestamp } = JSON.parse(raw) as { data: Record<string, LiveWeather>; timestamp: string };
          if (isCacheValid(timestamp)) { this.took(data, saved, tripId, now); continue; }
        }
      } catch { /* ignore */ }

      place ??= await this.geocode(dest);
      if (!place) {
        console.warn('[WeatherService] could not geocode destination:', dest);
        this.loadedFor = null; // allow a retry on the next load()/loadMany()
        return;
      }
      this.fetch(req, place, cacheKey, saved, tripId, now);
    }
  }

  private fetch(req: WeatherRequest, place: { lat: number; lon: number; name: string }, cacheKey: string,
                saved: ReadonlySet<string>, tripId: string | null, now: Date): void {
    const base = req.source === 'history'
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast';
    const url = base +
      `?latitude=${place.lat}&longitude=${place.lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
      `&temperature_unit=fahrenheit&timezone=auto` +
      `&start_date=${req.start}&end_date=${req.end}`;

    this.http.get<any>(url).subscribe({
      next: (data) => {
        const results: Record<string, LiveWeather> = {};
        const { time, temperature_2m_max, temperature_2m_min, weather_code } = data.daily;
        (time as string[]).forEach((date, i) => {
          // History can be missing a day's numbers; leave that day out rather than show 0°.
          if (temperature_2m_min[i] == null || temperature_2m_max[i] == null || weather_code[i] == null) return;
          results[date] = {
            city:  place.name,
            minF:  Math.round(temperature_2m_min[i]),
            maxF:  Math.round(temperature_2m_max[i]),
            code:  weather_code[i] as number,
          };
        });
        this.took(results, saved, tripId, now);
        try { localStorage.setItem(cacheKey, JSON.stringify({ data: results, timestamp: new Date().toISOString() })); }
        catch { /* storage full */ }
      },
      error: (err) => { console.error('[WeatherService] fetch failed:', err); this.loadedFor = null; }
    });
  }

  /** Show fetched days, and save the settled past ones the trip doesn't have yet. */
  private took(results: Record<string, LiveWeather>, saved: ReadonlySet<string>, tripId: string | null, now: Date): void {
    this._fetched.update(prev => ({ ...prev, ...results }));
    if (!tripId) return;
    for (const date of daysToSave(Object.keys(results), saved, now)) {
      const day: WeatherDayDoc = { ...results[date], savedAt: serverTimestamp() };
      // Another member may have saved it first; the rules refuse a second write, which is fine.
      runInInjectionContext(this.injector, () =>
        setDoc(doc(this.firestore, 'trips', tripId, 'weather', date), day).catch(() => { /* already saved */ }));
    }
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
