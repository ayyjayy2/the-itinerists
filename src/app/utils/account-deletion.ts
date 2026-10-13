/**
 * The record an account writes about itself as it is deleted (#452), for the
 * owner's Pulse: when, how old the account was, how many trips it was on and
 * when the last one ended. Deliberately nothing else: no name, email or trip
 * content. `at` is added by the caller as the server time.
 */
export interface AccountDeletionRecord {
  uid: string;
  accountCreatedAt: number;
  trips: number;
  lastTripEnd: string | null;
  test: boolean;
}

export function deletionRecord(
  profile: { uid: string; createdAt?: number; isTest?: boolean },
  trips: readonly { endDate?: string }[],
): AccountDeletionRecord {
  const ends = trips.map(t => t.endDate ?? '').filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return {
    uid: profile.uid,
    accountCreatedAt: Math.floor(Number(profile.createdAt) || 0),
    trips: trips.length,
    lastTripEnd: ends.length ? ends[ends.length - 1] : null,
    test: profile.isTest === true,
  };
}
