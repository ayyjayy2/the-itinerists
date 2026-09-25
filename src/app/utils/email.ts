/**
 * Email helpers. Accounts sign in by username, but Firebase needs an
 * email-shaped login, so older accounts carry a synthetic placeholder address
 * (`username@the-itinerists.local`) that can't receive mail. New accounts are
 * created with a real address; these helpers tell the two apart.
 */

/** Domain of the synthetic, undeliverable addresses given to pre-email accounts. */
export const PLACEHOLDER_DOMAIN = '@the-itinerists.local';

/** 'makaela@gmail.com' → 'm•••@gmail.com' (for confirmation messages). */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  return `${email[0]}•••${email.slice(at)}`;
}

/** A plausible, deliverable address: one @, something either side, a dotted domain, no spaces. */
export function isValidEmail(raw: string): boolean {
  const email = raw.trim().toLowerCase();
  if (!email || /\s/.test(email) || email.endsWith(PLACEHOLDER_DOMAIN)) return false;
  return /^[^@]+@[^@]+\.[^@]+$/.test(email);
}

/** True when the account has no real address: nothing on file, or the synthetic one. */
export function isPlaceholderEmail(email: string | undefined | null): boolean {
  return !email || email.endsWith(PLACEHOLDER_DOMAIN);
}

/** Should this signed-in account be nudged to add a recovery email? */
export function needsRecoveryEmail(user: { authEmail?: string } | null | undefined): boolean {
  return !!user && isPlaceholderEmail(user.authEmail);
}

/**
 * Keep the account's `authEmail` mirror in step with the real Auth email.
 * A recovery email is verified by clicking a link, which changes the Auth
 * email outside the app; the next time the app sees the account it writes the
 * new address back (and clears `pendingEmail` if that's what was confirmed).
 * Returns the fields to update, or null when nothing has changed.
 */
export function authEmailPatch(
  authEmail: string | null | undefined,
  user: { authEmail?: string; pendingEmail?: string } | null | undefined,
): { authEmail: string; pendingEmail?: string } | null {
  if (!authEmail || !user) return null;
  const current = (user.authEmail ?? '').toLowerCase();
  const actual  = authEmail.toLowerCase();
  if (current === actual) return null;
  const patch: { authEmail: string; pendingEmail?: string } = { authEmail: actual };
  if ((user.pendingEmail ?? '').toLowerCase() === actual) patch.pendingEmail = '';
  return patch;
}
