/**
 * Client-side password validation. Mirrors the server-enforced Identity Platform
 * policy (min 8 chars, requires uppercase + lowercase + number) so the UI can
 * tell the user exactly what's missing before Firebase rejects the request.
 */

export interface PasswordRule {
  label: string;
  met: boolean;
}

/** Each policy requirement and whether `pw` satisfies it. */
export function passwordRules(pw: string): PasswordRule[] {
  return [
    { label: 'At least 8 characters', met: pw.length >= 8 },
    { label: 'An uppercase letter',   met: /[A-Z]/.test(pw) },
    { label: 'A lowercase letter',    met: /[a-z]/.test(pw) },
    { label: 'A number',              met: /[0-9]/.test(pw) },
  ];
}

/** True when every requirement is met. */
export function isPasswordValid(pw: string): boolean {
  return passwordRules(pw).every(r => r.met);
}

/** Human-readable list of unmet requirements, or '' when the password is valid. */
export function passwordProblems(pw: string): string {
  const unmet = passwordRules(pw).filter(r => !r.met).map(r => r.label.toLowerCase());
  return unmet.length ? `Password needs: ${unmet.join(', ')}.` : '';
}
