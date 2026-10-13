/**
 * The one check for links people type in (stays, rental cars, Finance
 * entries): web, email and phone links only (#407). Used when a link is
 * saved and again when it's shown, so older saved links are covered too.
 */

const ALLOWED = new Set(['https:', 'http:', 'mailto:', 'tel:']);

/** A safe address for an `href`, or null if the text isn't one. A bare "booking.com/…" gets https://. */
export function safeLink(input: string | null | undefined): string | null {
  const text = (input ?? '').trim();
  if (!text || /\s/.test(text.replace(/^tel:[+\d\s().-]+$/i, 'tel:'))) return null;
  // No scheme: treat as a web address if it looks like one (a dot in the host part).
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(text);
  const candidate = hasScheme ? text : /^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(text) ? `https://${text}` : null;
  if (!candidate) return null;
  let url: URL;
  try { url = new URL(candidate); } catch { return null; }
  if (!ALLOWED.has(url.protocol)) return null;
  if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.hostname) return null;
  if (url.protocol === 'tel:' || url.protocol === 'mailto:') return candidate;
  return url.href;
}
