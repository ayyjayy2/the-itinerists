/**
 * Building HTML from strings, for the few places outside Angular templates
 * (Leaflet map pop-ups). Angular escapes template text by itself; strings
 * handed to a library don't get that, so typed text must be escaped here (#407).
 *
 * Use the `html` tag: every `${value}` is escaped unless it's a fragment the
 * tag built itself, so the safe way is also the easy one.
 *
 *   html`<b>${stay.name}</b>${stay.notes ? html`<div>${stay.notes}</div>` : ''}`
 */

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Markup characters as text. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, c => ENTITIES[c]);
}

/** HTML built by the `html` tag: trusted, so it isn't escaped again when nested. */
export class SafeHtml {
  constructor(private readonly value: string) {}
  toString(): string { return this.value; }
}

function piece(v: unknown): string {
  if (v instanceof SafeHtml) return v.toString();
  if (Array.isArray(v)) return v.map(piece).join('');
  if (v === null || v === undefined || v === false) return '';
  return escapeHtml(v);
}

/** Template tag that escapes every interpolated value (see the file comment). */
export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0];
  values.forEach((v, i) => { out += piece(v) + strings[i + 1]; });
  return new SafeHtml(out);
}

/** A colour code for a style attribute (#rgb … #rrggbbaa), or the fallback. */
export function safeColor(value: string | null | undefined, fallback: string): string {
  return value && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : fallback;
}
