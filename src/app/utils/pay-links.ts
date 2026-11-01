import { money } from './event-text';

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

/**
 * The link that opens `app` to pay `handle`. The amount is filled in where
 * the app takes it in that currency (Venmo: US dollars; Cash App: US dollars
 * or pounds; PayPal: any); otherwise the link opens their page and the payer
 * types it.
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
      return `https://venmo.com/u/${h}?${q}`;
    }
    case 'paypal':
      return `https://paypal.me/${h}${amt ? `/${amt}${encodeURIComponent(cur)}` : ''}`;
    case 'cashapp':
      return `https://cash.app/$${h}${amt && (cur === 'USD' || cur === 'GBP') ? `/${amt}` : ''}`;
  }
}

/** The reminder on the bell, from the payer's side: friendly, never "X reminded you". */
export function reminderText(payee: string, amount: number, currency: string): string {
  return `Don't forget to pay ${payee}: ${money(amount, currency)}`;
}

/** At most one reminder a day for each pair (the rules hold to 20 hours, so "tomorrow" always works). */
export const REMINDER_GAP_MS = 20 * 60 * 60 * 1000;
export function canRemind(lastAt: number | undefined, now: number): boolean {
  return !lastAt || now - lastAt >= REMINDER_GAP_MS;
}
