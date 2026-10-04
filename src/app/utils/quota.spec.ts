import { QUOTA_LIMITS, QUOTA_WINDOW_MS, QuotaFullError, quotaStep, readCounter, toMillis } from './quota';

describe('quota', () => {
  const now = 1_800_000_000_000;

  it('starts a window when there is no counter yet', () => {
    expect(quotaStep(null, now, 50)).toBe('start');
  });

  it('adds one inside the window while under the limit', () => {
    expect(quotaStep({ windowStart: now - 1000, count: 49 }, now, 50)).toBe('add');
  });

  it('stops at the limit inside the window', () => {
    expect(quotaStep({ windowStart: now - 1000, count: 50 }, now, 50)).toBe('full');
  });

  it('starts over once 24 hours have passed, even at the limit', () => {
    expect(quotaStep({ windowStart: now - QUOTA_WINDOW_MS, count: 50 }, now, 50)).toBe('start');
  });

  it('reads Timestamps, Dates and numbers', () => {
    expect(toMillis({ toMillis: () => 5 })).toBe(5);
    expect(toMillis(new Date(7))).toBe(7);
    expect(toMillis(9)).toBe(9);
    expect(toMillis(undefined)).toBeNull();
  });

  it('reads a stored counter, or null when it is missing or malformed', () => {
    expect(readCounter({ windowStart: new Date(3), count: 2, at: new Date(4) })).toEqual({ windowStart: 3, count: 2 });
    expect(readCounter(undefined)).toBeNull();
    expect(readCounter({ count: 2 })).toBeNull();
  });

  it('says what the limit is and when to try again', () => {
    expect(new QuotaFullError('photos').message).toContain(`${QUOTA_LIMITS.photos} outfit photos today`);
    expect(new QuotaFullError('trips').message).toContain('tomorrow');
  });
});
