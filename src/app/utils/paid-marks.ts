/**
 * Finance "paid" ticks, shared with the whole trip (#448). A tick is one debt
 * item marked paid: who owes (from), who is owed (to) and for which expense
 * (itemId). Finance has always keyed them as `from__to__itemId`; each one is
 * now a record under trips/{id}/payments, so both sides see the same thing.
 */

export function paidKey(from: string, to: string, itemId: string): string {
  return `${from}__${to}__${itemId}`;
}

export function parsePaidKey(key: string): { from: string; to: string; itemId: string } | null {
  const parts = key.split('__');
  if (parts.length !== 3 || parts.some(p => !p)) return null;
  const [from, to, itemId] = parts;
  return { from, to, itemId };
}

/** A record id for a tick: the key, made safe for a document id (no slashes, never `__…__`). */
export function markId(key: string): string {
  return 'p_' + encodeURIComponent(key).replace(/\./g, '%2E');
}

/** Ticks saved on this device (before ticks were shared) that the trip doesn't have yet. */
export function ticksToShare(local: readonly string[], shared: ReadonlySet<string>): string[] {
  return local.filter(k => !shared.has(k) && parsePaidKey(k) !== null);
}
