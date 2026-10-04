/**
 * Per-account daily limits on the writes that cost the most: outfit photos
 * and new trips. The security rules enforce them (firestore.rules,
 * quotaLimits() and _quotas/{uid}/kinds/{kind}); the app checks first so it
 * can say so kindly instead of failing. Keep the numbers in step with the rules.
 */
export type QuotaKind = 'photos' | 'trips';

export const QUOTA_LIMITS: Record<QuotaKind, number> = { photos: 50, trips: 20 };
export const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The stored counter, with its window start in milliseconds. */
export interface QuotaCounter { windowStart: number; count: number }

/** What the next limited write does to the counter: start a new window, add one, or stop. */
export type QuotaStep = 'start' | 'add' | 'full';

export function quotaStep(counter: QuotaCounter | null, now: number, limit: number): QuotaStep {
  if (!counter || now >= counter.windowStart + QUOTA_WINDOW_MS) return 'start';
  return counter.count < limit ? 'add' : 'full';
}

/** A Firestore Timestamp, a Date or a number of milliseconds → milliseconds (null if none). */
export function toMillis(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (v && typeof (v as { toMillis?: unknown }).toMillis === 'function') return (v as { toMillis(): number }).toMillis();
  return null;
}

export function readCounter(data: Record<string, unknown> | undefined): QuotaCounter | null {
  const windowStart = toMillis(data?.['windowStart']);
  const count = data?.['count'];
  return windowStart !== null && typeof count === 'number' ? { windowStart, count } : null;
}

export class QuotaFullError extends Error {
  constructor(readonly kind: QuotaKind) {
    super(kind === 'photos'
      ? `You've added ${QUOTA_LIMITS.photos} outfit photos today. You can add more tomorrow.`
      : `You've created ${QUOTA_LIMITS.trips} trips today. You can create more tomorrow.`);
  }
}
