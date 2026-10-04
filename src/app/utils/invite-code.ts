/** Letters and digits that can't be mistaken for each other (no I, O, 0, 1). */
export const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * A trip invite code from the cryptographic random source (Math.random is
 * predictable). 32 characters divide 256 evenly, so each is equally likely:
 * 8 characters give 40 bits, and a code lives 7 days.
 */
export function randomCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => INVITE_CODE_CHARS[b % INVITE_CODE_CHARS.length]).join('');
}
