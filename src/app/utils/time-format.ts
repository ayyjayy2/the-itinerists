import { parseTimeString } from './first-up';

/**
 * One time format everywhere: times are stored and shown as "h:mm AM/PM".
 * These helpers bridge that display string and the native `<input type="time">`
 * value ("HH:mm"), and tidy up legacy strings typed by hand.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** "h:mm AM/PM" for 24-hour parts. */
export function formatTime12(h: number, min: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${pad(min)} ${ampm}`;
}

/** Display string ("3:50 PM", "4:20pm", "9 am", "14:30") → "HH:mm" for a time input, or ''. */
export function toInputTime(display: string | undefined): string {
  const t = parseTimeString(display);
  return t ? `${pad(t.h)}:${pad(t.min)}` : '';
}

/** Native time-input value ("HH:mm") → "h:mm AM/PM", or '' when the picker is empty. */
export function fromInputTime(value: string | undefined): string {
  if (!value) return '';
  const [h, min] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(min)) return '';
  return formatTime12(h, min);
}

/** Any stored string → the canonical "h:mm AM/PM"; unparseable text is left untouched. */
export function normalizeTime(display: string | undefined): string {
  if (!display) return '';
  const t = parseTimeString(display);
  return t ? formatTime12(t.h, t.min) : display;
}
