import { RateGate, missIsFresh } from './rate-gate';

/**
 * Every place-name lookup in the app (OpenStreetMap's Nominatim) goes through
 * here (#696). Its free service allows about one request a second and refused
 * us (429) after a busy day, so:
 * - answers are kept on the device (found: 30 days; not found: 7 days),
 * - the same lookup asked twice at once goes out once,
 * - requests go out one a second across the whole app, not per page,
 * - a refusal or no connection pauses lookups for two minutes and throws
 *   PlaceUnavailable, so callers never take it for "not found".
 */
export interface PlaceHit { lat: number; lng: number }

export class PlaceUnavailable extends Error {
  constructor() { super('Place lookup unavailable'); }
}

const STORE_KEY = 'tp_places_v1';
const FOUND_DAYS = 30;
const PAUSE_MS = 2 * 60_000;
const BASE = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=en';

type Kept = Record<string, { hit: PlaceHit | null; at: number }>;

export class PlaceSearch {
  private pausedUntil = 0;
  private inFlight = new Map<string, Promise<PlaceHit | null>>();

  constructor(
    private fetchFn: typeof fetch,
    private storage: Storage | null,
    private now: () => number = Date.now,
    private gate = new RateGate(1100),
  ) {}

  /** The first match for `query`, or null when there is none. `extra` adds search settings (e.g. a viewbox). */
  find(query: string, extra = ''): Promise<PlaceHit | null> {
    const url = `${BASE}&q=${encodeURIComponent(query.trim())}${extra}`;
    const kept = this.read()[url];
    if (kept && (kept.hit ? this.now() - kept.at < FOUND_DAYS * 86_400_000 : missIsFresh(kept.at, this.now()))) {
      return Promise.resolve(kept.hit);
    }
    const pending = this.inFlight.get(url);
    if (pending) return pending;
    const ask = this.ask(url).finally(() => this.inFlight.delete(url));
    this.inFlight.set(url, ask);
    return ask;
  }

  private async ask(url: string): Promise<PlaceHit | null> {
    if (this.now() < this.pausedUntil) throw new PlaceUnavailable();
    await this.gate.wait();
    if (this.now() < this.pausedUntil) throw new PlaceUnavailable();
    let data: { lat: string; lon: string }[];
    try {
      const res = await this.fetchFn(url);
      if (!res.ok) throw new Error(String(res.status));
      data = await res.json();
    } catch {
      this.pausedUntil = this.now() + PAUSE_MS;
      throw new PlaceUnavailable();
    }
    const first = Array.isArray(data) ? data[0] : undefined;
    const hit = first ? { lat: Number(first.lat), lng: Number(first.lon) } : null;
    this.keep(url, hit);
    return hit;
  }

  private read(): Kept {
    try { return JSON.parse(this.storage?.getItem(STORE_KEY) ?? '{}'); } catch { return {}; }
  }

  private keep(url: string, hit: PlaceHit | null): void {
    try {
      const all = this.read();
      all[url] = { hit, at: this.now() };
      this.storage?.setItem(STORE_KEY, JSON.stringify(all));
    } catch { /* storage full or blocked: the answer just isn't kept */ }
  }
}

function deviceStorage(): Storage | null {
  try { return localStorage; } catch { return null; }
}

/** The app's one place lookup: one queue and one memory for every page. */
export const placeSearch = new PlaceSearch((url, init) => fetch(url, init), deviceStorage());
