/**
 * Keeps requests to a service at most one per interval (Nominatim asks for one
 * a second). Each caller waits only for what's left of the interval since the
 * last request went out, so time spent waiting for an answer counts, and
 * callers that arrive together go out one interval apart, in order.
 */
export class RateGate {
  private nextAt = 0;

  constructor(
    private intervalMs: number,
    private now: () => number = Date.now,
    private sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms)),
  ) {}

  async wait(): Promise<void> {
    const at = Math.max(this.now(), this.nextAt);
    this.nextAt = at + this.intervalMs;          // reserve the slot before sleeping
    const ms = at - this.now();
    if (ms > 0) await this.sleep(ms);
  }
}

/** How long a place that couldn't be found is left alone before trying again. */
const MISS_DAYS = 7;

/** True while a remembered miss is recent enough not to look the place up again. */
export function missIsFresh(missedAt: number, now: number): boolean {
  return now - missedAt < MISS_DAYS * 86_400_000;
}
