/**
 * What the app records when its Content-Security-Policy blocks something
 * (#445): the rule and the blocked host only. Paths and queries are left out
 * because they can carry tokens or codes.
 */
export function cspViolationMessage(e: { effectiveDirective?: string; blockedURI?: string }): string {
  const raw = e.blockedURI ?? '';
  let what = raw || 'unknown';
  try { if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) what = new URL(raw).host; } catch { /* keep the raw word */ }
  return `${e.effectiveDirective || 'unknown'} blocked ${what}`;
}
