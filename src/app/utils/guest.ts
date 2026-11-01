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
