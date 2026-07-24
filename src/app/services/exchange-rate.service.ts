import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Rates } from '../utils/currency';

const CACHE_PREFIX = 'tripplanner_fx_';
const API = 'https://api.frankfurter.dev/v1';

/**
 * Date-specific exchange rates from Frankfurter (free ECB data, no key).
 * Each expense converts at the rate for its own date. Rates are cached per
 * (home, date) in localStorage; one in-flight request is shared per key.
 */
@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  private http = inject(HttpClient);
  private mem = new Map<string, Rates>();
  private inflight = new Map<string, Promise<Rates | null>>();

  /**
   * Rates for `dateISO` with base = `home` (rates[X] = X per 1 home). Future
   * dates and today resolve to the latest available. Returns null on failure so
   * callers can skip conversion rather than show a wrong number.
   */
  async ratesFor(home: string, dateISO: string): Promise<Rates | null> {
    const date = this.clampDate(dateISO);
    const key = `${home}|${date}`;
    if (this.mem.has(key)) return this.mem.get(key)!;

    const cached = this.readCache(key);
    if (cached) { this.mem.set(key, cached); return cached; }

    if (this.inflight.has(key)) return this.inflight.get(key)!;
    const p = this.fetchRates(home, date, key).finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  /** Preload rates for a set of (home, date) pairs; resolves when all settle. */
  async preload(home: string, dates: Iterable<string>): Promise<void> {
    await Promise.all([...new Set(dates)].map(d => this.ratesFor(home, d).catch(() => null)));
  }

  private async fetchRates(home: string, date: string, key: string): Promise<Rates | null> {
    try {
      const url = `${API}/${date}?base=${encodeURIComponent(home)}`;
      const res = await firstValueFrom(this.http.get<{ rates?: Rates }>(url));
      const rates = res?.rates ?? null;
      if (!rates) return null;
      this.mem.set(key, rates);
      this.writeCache(key, rates);
      return rates;
    } catch (err) {
      console.error('[ExchangeRateService] fetch failed:', err);
      return null;
    }
  }

  /** Frankfurter has no future data; clamp future/today to "latest". */
  private clampDate(dateISO: string): string {
    const today = new Date().toISOString().slice(0, 10);
    return (!dateISO || dateISO >= today) ? 'latest' : dateISO;
  }

  private readCache(key: string): Rates | null {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      return raw ? JSON.parse(raw) as Rates : null;
    } catch { return null; }
  }

  private writeCache(key: string, rates: Rates): void {
    // A historical date's rates never change; "latest" is refreshed by the API
    // over time but a day-stale rate is acceptable for an approximate total.
    try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(rates)); }
    catch { /* storage full */ }
  }
}
