/**
 * Wording for the diagnostic notes in `_appLogs` (#484, #485). They say that
 * something happened and how long it took, never what anyone wrote: no invite
 * codes, no trip or account details.
 */

/** A start slower than this (launch, or a fresh sign-in, → the open trip's data) gets a note. */
export const SLOW_START_MS = 4_000;

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export interface StartTimes {
  /** Launch → the app knows whether someone is signed in. */
  authMs: number;
  /** `from` → the open trip's data is ready. */
  readyMs: number;
  /** 'launch' when already signed in; 'sign-in' when they signed in by hand (time on the form doesn't count). */
  from: 'launch' | 'sign-in';
  native: boolean;
}

export function startupReport(t: StartTimes): string | null {
  if (t.readyMs < SLOW_START_MS) return null;
  return `slow start: sign-in known ${secs(t.authMs)} after launch, trip ready ${secs(t.readyMs)} after ${t.from} (${t.native ? 'iPhone app' : 'website'})`;
}

/**
 * Remembers invites the owner closed on this device and notices if one of them
 * comes back in the trip's live invite list — the bug in #484.
 */
export class ClosedInviteTracker {
  /** How long after closing an invite we keep watching for it. */
  static readonly WATCH_MS = 10 * 60_000;
  private closedAt = new Map<string, number>();

  closed(code: string, now: number): void { this.closedAt.set(code, now); }

  /** A note the first time a closed code is live again; null otherwise. */
  check(liveCodes: readonly string[], meta: { fromCache: boolean; pendingWrites: boolean }, now: number): string | null {
    let report: string | null = null;
    for (const [code, at] of [...this.closedAt]) {
      if (now - at > ClosedInviteTracker.WATCH_MS) { this.closedAt.delete(code); continue; }
      if (!liveCodes.includes(code)) continue;   // gone, as it should be (for now)
      this.closedAt.delete(code);                // report each code once
      report ??= `closed invite is live again ${secs(now - at)} after closing (${meta.fromCache ? 'from cache' : 'from server'}, ${meta.pendingWrites ? 'pending writes' : 'no pending writes'})`;
    }
    return report;
  }
}
