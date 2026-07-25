import { ActivityLogEntry } from '../models/trip.models';

/** Human line for a feed entry ("Tess joined the trip"). */
export function activityText(a: ActivityLogEntry): string {
  switch (a.action) {
    case 'member_added':    return `${a.targetName} joined the trip`;
    case 'member_removed':  return `${a.performedByName} removed ${a.targetName}`;
    case 'member_left':     return `${a.targetName} left the trip`;
    case 'member_restored': return `${a.performedByName} added ${a.targetName} back`;
    default:                return 'updated the trip';
  }
}

/** "5m ago" / "3h ago" / "2d ago" relative to a supplied now (unix ms). */
export function timeAgo(ts: number, now: number): string {
  const s = Math.floor((now - ts) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Bell badge: entries by OTHER members newer than the account's high-water mark. */
export function unseenActivityCount(
  entries: readonly ActivityLogEntry[], myUid: string, lastSeenAt: number,
): number {
  return entries.filter(e => e.performedByUid !== myUid && e.timestamp > lastSeenAt).length;
}
