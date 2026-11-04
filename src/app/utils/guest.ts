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

interface NamedMember { uid: string; displayName: string; leftAt?: number }
const sameName = (a: string, b: string) => guestName(a).toLowerCase() === guestName(b).toLowerCase();

/**
 * Someone else on the trip with this name (#768), whatever the case. Expenses
 * and plans name people, so two people can't share one: a match that left as a
 * guest may be them coming back; anyone else means picking another name.
 */
export function nameClash(name: string, myUid: string, members: readonly NamedMember[]): { uid: string; name: string; left: boolean } | null {
  const m = members.find(x => x.uid !== myUid && sameName(x.displayName, name));
  return m ? { uid: m.uid, name: m.displayName, left: !!m.leftAt } : null;
}

/** Guests who left and came back under the same name (#768): the same person, so they're shown once and not reviewed. */
export function returnedGuests(members: readonly NamedMember[]): Set<string> {
  const here = members.filter(m => !m.leftAt);
  return new Set(members.filter(m => m.leftAt && here.some(h => sameName(h.displayName, m.displayName))).map(m => m.uid));
}
