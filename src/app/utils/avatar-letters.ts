/** A–Z, the full letter set behind the picker's "More" button. */
export const ALL_LETTERS: readonly string[] = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

/** True when the stored avatar is a single A–Z letter rather than an emoji. */
export function isLetterAvatar(avatar: string | undefined): boolean {
  return !!avatar && avatar.length === 1 && ALL_LETTERS.includes(avatar);
}

/**
 * The handful of letters to show before "More": the display name's initials
 * first (upper-cased, A–Z only, de-duplicated), then the alphabet to fill up
 * to `count`.
 */
export function starterLetters(name: string, count: number): string[] {
  const out: string[] = [];
  const push = (ch: string) => { if (out.length < count && !out.includes(ch)) out.push(ch); };
  for (const word of name.trim().split(/\s+/)) {
    const first = word.charAt(0).toUpperCase();
    if (ALL_LETTERS.includes(first)) push(first);
  }
  for (const ch of ALL_LETTERS) push(ch);
  return out;
}
