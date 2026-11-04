import { money } from './event-text';
import type { Rates } from './currency';

/**
 * Paying someone back (#532): each person may add their handle for a payment
 * app to their profile, and "Pay" opens that app with the amount filled in.
 * The app only builds a link; it never sees or moves money.
 */
export type PayApp = 'venmo' | 'paypal' | 'cashapp';
export type PayHandles = Partial<Record<PayApp, string>>;

export const PAY_APPS: readonly { app: PayApp; label: string; hint: string }[] = [
  { app: 'venmo', label: 'Venmo', hint: 'Your Venmo username' },
  { app: 'paypal', label: 'PayPal', hint: 'Your PayPal.me name' },
  { app: 'cashapp', label: 'Cash App', hint: 'Your $cashtag' },
];

/** A handle as the rules accept it: letters, digits, dot, dash and underscore, at most 40. */
const HANDLE = /^[A-Za-z0-9._-]{1,40}$/;

/**
 * Tidy what someone typed or pasted into their handle: drop a leading @ or $,
 * and take the name out of a profile link (venmo.com/u/maya, paypal.me/maya,
 * cash.app/$maya). Returns '' when nothing usable is left.
 */
export function normalizeHandle(app: PayApp, raw: string): string {
  let h = raw.trim();
  const fromLink: Record<PayApp, RegExp> = {
    venmo: /venmo\.com\/(?:u\/)?([^/?#\s]+)/i,
    paypal: /paypal\.(?:me|com\/paypalme)\/([^/?#\s]+)/i,
    cashapp: /cash\.app\/\$?([^/?#\s]+)/i,
  };
  const m = h.match(fromLink[app]);
  if (m) h = m[1];
  h = h.replace(/^[@$]+/, '');
  return HANDLE.test(h) ? h : '';
}

/** Whether a stored handles map holds only known apps with valid handles. */
export function cleanHandles(raw: Partial<Record<PayApp, string>>): PayHandles {
  const out: PayHandles = {};
  for (const { app } of PAY_APPS) {
    const h = normalizeHandle(app, raw[app] ?? '');
    if (h) out[app] = h;
  }
  return out;
}

/** The currencies each app can be paid in, preferred first; empty means any (#666). */
const APP_CURRENCIES: Record<PayApp, readonly string[]> = { venmo: ['USD'], paypal: [], cashapp: ['USD', 'GBP'] };

/**
 * What to send with `app` (#666): the payer's own currency (#688) when they have
 * one, the app takes it and there's a rate; else the trip's own amount when the
 * app takes that currency; else the amount converted to the app's currency with
 * `rates` (base = the trip's currency, so rates[X] = X per 1 trip unit). Null
 * when there's no rate yet: the app then opens without an amount.
 */
export function payAmount(app: PayApp, amount: number, currency: string, rates: Rates | null, own?: string): { amount: number; currency: string } | null {
  const cur = currency.toUpperCase();
  const takes = APP_CURRENCIES[app];
  const convert = (to: string) => rates?.[to] ? { amount: Math.round(amount * rates[to] * 100) / 100, currency: to } : null;
  if (own && own !== cur && (!takes.length || takes.includes(own))) {
    const mine = convert(own);
    if (mine) return mine;
  }
  if (!takes.length || takes.includes(cur)) return { amount, currency: cur };
  return convert(takes[0]);
}

/**
 * The link that opens `app` to pay `handle`. The amount is filled in where
 * the app takes it in that currency (Venmo: US dollars; Cash App: US dollars
 * or pounds; PayPal: any; see payAmount); only Venmo takes a note. With no
 * handle saved the app's own pay screen opens and the payer picks the friend
 * (only Venmo can still carry the amount and note).
 */
export function payLink(app: PayApp, handle: string, amount: number, currency: string, note = ''): string {
  const h = encodeURIComponent(handle);
  const amt = amount > 0 ? amount.toFixed(2) : '';
  const cur = currency.toUpperCase();
  switch (app) {
    case 'venmo': {
      const q = new URLSearchParams({ txn: 'pay' });
      if (amt && cur === 'USD') q.set('amount', amt);
      if (note) q.set('note', note);
      // Spaces as %20: Venmo shows URLSearchParams' '+' literally (#676). A real '+' is already %2B.
      const qs = q.toString().replace(/\+/g, '%20');
      return handle ? `https://venmo.com/u/${h}?${qs}` : `https://venmo.com/?${qs}`;
    }
    case 'paypal':
      if (!handle) return 'https://www.paypal.com/myaccount/transfer/homepage/pay';
      return `https://paypal.me/${h}${amt ? `/${amt}${encodeURIComponent(cur)}` : ''}`;
    case 'cashapp':
      if (!handle) return 'https://cash.app/';
      return `https://cash.app/$${h}${amt && (cur === 'USD' || cur === 'GBP') ? `/${amt}` : ''}`;
  }
}

/**
 * The app's own link, for the iPhone app (#681): iOS opens it straight away, where the
 * web link goes through Safari, asks first, and Venmo's site puts '+' back in the note.
 * Only Venmo has one that fills anything in; null for the others.
 */
export function payAppLink(app: PayApp, handle: string, amount: number, currency: string, note = ''): string | null {
  if (app !== 'venmo') return null;
  const q = new URLSearchParams({ txn: 'pay' });
  if (handle) q.set('recipients', handle);
  if (amount > 0 && currency.toUpperCase() === 'USD') q.set('amount', amount.toFixed(2));
  if (note) q.set('note', note);
  return `venmo://paycharge?${q.toString().replace(/\+/g, '%20')}`;
}

/** The reminder on the bell, from the payer's side: friendly, never "X reminded you". */
export function reminderText(payee: string, amount: number, currency: string): string {
  return `Don't forget to pay ${payee}: ${money(amount, currency)}`;
}

/** To the person owed when someone marks a payment to them (#716); the bell puts the payer's name first. */
export function claimText(amount: number, currency: string, appLabel: string): string {
  return `says they paid you ${money(amount, currency)} with ${appLabel}. Confirm it in Finance.`;
}

/** To the payer when the person owed answers (#716); the bell puts that person's name first. */
export function claimAnswerText(answer: 'received' | 'not-received', amount: number, currency: string): string {
  return answer === 'received'
    ? `got your ${money(amount, currency)} payment. You two are settled up.`
    : `hasn’t received your ${money(amount, currency)} payment yet. Check the app you paid with, then mark it paid again.`;
}

/** At most one reminder a day for each pair (the rules hold to 20 hours, so "tomorrow" always works). */
export const REMINDER_GAP_MS = 20 * 60 * 60 * 1000;
export function canRemind(lastAt: number | undefined, now: number): boolean {
  return !lastAt || now - lastAt >= REMINDER_GAP_MS;
}

/** Reminders open on the trip's last day (#664): asking to be paid back is for the end of the trip. */
export function remindersOpen(tripEndISO: string | undefined, todayISO: string): boolean {
  return !tripEndISO || todayISO >= tripEndISO;
}
