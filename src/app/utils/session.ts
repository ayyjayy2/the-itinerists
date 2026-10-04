/**
 * Sessions last 90 days from when the person last entered their password.
 * The security rules refuse older sessions (firestore.rules isSignedIn(),
 * storage.rules); the app signs the person out first so they see why,
 * instead of a page of permission errors. Keep the number in step with the rules.
 */
export const SESSION_MAX_DAYS = 90;
const SESSION_MAX_MS = SESSION_MAX_DAYS * 24 * 60 * 60 * 1000;

export const SESSION_EXPIRED_MESSAGE =
  `For your security, please sign in again. You stay signed in for ${SESSION_MAX_DAYS} days at a time.`;

/** True when the last password sign-in (Firebase `metadata.lastSignInTime`) is
 *  over the limit. Unknown or unreadable times count as fresh: the rules still decide. */
export function sessionExpired(lastSignInTime: string | undefined | null, now: number): boolean {
  if (!lastSignInTime) return false;
  const at = Date.parse(lastSignInTime);
  return Number.isFinite(at) && now - at >= SESSION_MAX_MS;
}
