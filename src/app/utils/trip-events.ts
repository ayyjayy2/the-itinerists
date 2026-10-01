import { TripEvent } from '../models/trip.models';

/**
 * True when this event is meant for `uid` (everyone, or named) and is not
 * their own. Events done by or to a test account are left out unless
 * `showTest` is on, which the pages set for a test trip.
 */
export function isFor(ev: TripEvent, uid: string, showTest = false): boolean {
  if (ev.test && !showTest) return false;
  if (ev.actorUid === uid) return false;
  return ev.audience === 'all' || ev.audience.includes(uid);
}

/** Events aimed at `uid`, newest first (own actions excluded). */
export function eventsForMe(events: readonly TripEvent[], uid: string, showTest = false): TripEvent[] {
  return events.filter(e => isFor(e, uid, showTest)).sort((a, b) => b.timestamp - a.timestamp);
}

/** Bell badge: events for `uid` newer than their high-water mark. */
export function unseenEvents(events: readonly TripEvent[], uid: string, lastSeenAt: number, showTest = false): TripEvent[] {
  return eventsForMe(events, uid, showTest).filter(e => e.timestamp > lastSeenAt);
}

/** Several edits by one person to one item inside this window update the same event. */
export const COLLAPSE_WINDOW_MS = 5 * 60_000;

/**
 * Remembers the last event written per actor + kind + item so a burst of edits
 * becomes one line instead of five. Trip-level events (no item) never collapse.
 */
export class CollapseTracker {
  private last = new Map<string, { id: string; at: number }>();

  private key(actorUid: string, kind: string, itemId: string): string {
    return `${actorUid}|${kind}|${itemId}`;
  }

  /** The existing event id to update, or null to create a new one. */
  reuse(actorUid: string, kind: string, itemId: string, now: number): string | null {
    if (!itemId) return null;
    const hit = this.last.get(this.key(actorUid, kind, itemId));
    return hit && now - hit.at < COLLAPSE_WINDOW_MS ? hit.id : null;
  }

  remember(actorUid: string, kind: string, itemId: string, id: string, now: number): void {
    if (!itemId) return;
    this.last.set(this.key(actorUid, kind, itemId), { id, at: now });
  }

  /** A removal ends the item's story; the next event for that id starts fresh. */
  forget(actorUid: string, kind: string, itemId: string): void {
    this.last.delete(this.key(actorUid, kind, itemId));
  }

  reset(): void { this.last.clear(); }
}
