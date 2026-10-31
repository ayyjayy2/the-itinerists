/**
 * Who reached an invite, for the invite-to-join rate in Pulse (#609). There is
 * no list of people invited: an invite is a shareable link or code. So a
 * device that reaches a live invite, by opening the link or typing the code,
 * counts once per trip; joins come from the trip's members.
 */

export type InviteVia = 'link' | 'code';

const VISITOR_KEY = 'itinerists.visitor';
const SEEN_KEY = 'itinerists.inviteOpens';

/** A random id for this device, kept between visits; no account needed. */
export function visitorId(store: Pick<Storage, 'getItem' | 'setItem'> | null, make: () => string): string {
  try {
    const kept = store?.getItem(VISITOR_KEY);
    if (kept && /^[0-9a-f-]{8,64}$/i.test(kept)) return kept;
    const id = make();
    store?.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return make();
  }
}

/**
 * Whether this device's visit to `tripId`'s invite still needs recording, and
 * notes it if so: each device counts once per trip, however often it checks
 * the code (the sign-up form checks it on arrival and again on blur).
 */
export function firstOpen(store: Pick<Storage, 'getItem' | 'setItem'> | null, tripId: string): boolean {
  try {
    const seen: string[] = JSON.parse(store?.getItem(SEEN_KEY) ?? '[]');
    if (seen.includes(tripId)) return false;
    store?.setItem(SEEN_KEY, JSON.stringify([...seen, tripId].slice(-50)));
    return true;
  } catch {
    return true;
  }
}
