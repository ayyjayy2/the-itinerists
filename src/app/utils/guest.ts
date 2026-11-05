import { BACKGROUND_COLORS, pickLetterColor } from './avatar-contrast';

/**
 * A guest (#610) gives only a name, so their avatar is made from it: the
 * first letter on one of the avatar backgrounds, picked by the name so the
 * same name looks the same. A name with no A–Z letter gets a smile.
 */
export function guestAvatar(name: string): { avatarEmoji: string; color: string; avatarLetterColor: string } {
  const trimmed = name.trim();
  const letter = trimmed.normalize('NFD').replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase();
  let hash = 0;
  for (const ch of trimmed.toLowerCase()) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  const color = BACKGROUND_COLORS[hash % BACKGROUND_COLORS.length];
  return letter
    ? { avatarEmoji: letter, color, avatarLetterColor: pickLetterColor(color, undefined) }
    : { avatarEmoji: '🙂', color, avatarLetterColor: '' };
}

/** The name a guest types: trimmed, inner spaces collapsed, at most 40 characters. */
export function guestName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 40);
}

interface NamedMember { uid: string; displayName: string; leftAt?: number; isGuest?: boolean; joinedAt?: number }
const sameName = (a: string, b: string) => guestName(a).toLowerCase() === guestName(b).toLowerCase();
const isGuestMember = (m: NamedMember) => !!(m.isGuest || m.leftAt);

/**
 * Someone else on the trip with this name (#768), whatever the case. Expenses
 * and plans name people, so two people can't share one: a guest with it (logged
 * out or not, #776) may be them coming back; anyone with an account means
 * picking another name.
 */
export function nameClash(name: string, myUid: string, members: readonly NamedMember[]): { uid: string; name: string; guest: boolean } | null {
  const m = members.find(x => x.uid !== myUid && sameName(x.displayName, name));
  return m ? { uid: m.uid, name: m.displayName, guest: isGuestMember(m) } : null;
}

/**
 * Guests who came back under the same name (#768, #776): the same person, so
 * only the newest is shown, and the earlier ones aren't reviewed. Someone with
 * an account is never hidden.
 */
export function returnedGuests(members: readonly NamedMember[]): Set<string> {
  const hidden = new Set<string>();
  for (const m of members) {
    if (!isGuestMember(m)) continue;
    const later = members.some(o => o.uid !== m.uid && sameName(o.displayName, m.displayName)
      && (!o.leftAt || !!m.leftAt) && (o.joinedAt ?? 0) >= (m.joinedAt ?? 0) && !(m.leftAt && o.leftAt));
    if (later) hidden.add(m.uid);
  }
  return hidden;
}

/** A name nobody else on the trip has: `base`, else "base 2", "base 3"… (#787: a placeholder while a taken name is settled). */
export function freeName(base: string, myUid: string, members: readonly NamedMember[]): string {
  for (let n = 1; ; n++) {
    const name = n === 1 ? base : `${base} ${n}`;
    if (!nameClash(name, myUid, members)) return name;
  }
}
