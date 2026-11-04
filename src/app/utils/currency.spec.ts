import { convertAmount, perCurrencySubtotals, convertedTotal, convertShare, perCurrencyText, lockRate, rateDay, needsNewRate, inOwnCurrency, amountText, groupCurrencies, lockRates, missingRates, mergeRates } from './currency';

// Frankfurter-style rates table: base = the "to" currency (here EUR), so
// rates[X] = how many X per 1 EUR. EUR itself is implicitly 1.
const eurRates = { USD: 1.10, GBP: 0.85 }; // 1 EUR = 1.10 USD = 0.85 GBP

describe('convertAmount', () => {
  it('returns the amount unchanged when from === to', () => {
    expect(convertAmount(100, 'EUR', 'EUR', eurRates)).toBeCloseTo(100, 6);
  });

  it('converts a foreign amount into the base currency', () => {
    // 110 USD / 1.10 = 100 EUR
    expect(convertAmount(110, 'USD', 'EUR', eurRates)).toBeCloseTo(100, 6);
    // 85 GBP / 0.85 = 100 EUR
    expect(convertAmount(85, 'GBP', 'EUR', eurRates)).toBeCloseTo(100, 6);
  });

  it('returns null when the source rate is missing', () => {
    expect(convertAmount(100, 'JPY', 'EUR', eurRates)).toBeNull();
  });
});

describe('perCurrencySubtotals', () => {
  it('groups exact sums by entry currency', () => {
    const entries = [
      { amount: 50, currency: 'EUR' },
      { amount: 30, currency: 'EUR' },
      { amount: 20, currency: 'USD' },
    ];
    expect(perCurrencySubtotals(entries)).toEqual({ EUR: 80, USD: 20 });
  });

  it('is empty for no entries', () => {
    expect(perCurrencySubtotals([])).toEqual({});
  });
});

describe('convertedTotal', () => {
  const ratesByDate = {
    '2026-03-01': { USD: 1.10, GBP: 0.85 }, // base EUR
    '2026-03-02': { USD: 1.20, GBP: 0.80 },
  };

  it('sums each entry converted at its own date rate', () => {
    const entries = [
      { amount: 100, currency: 'EUR', date: '2026-03-01' }, // 100 EUR
      { amount: 110, currency: 'USD', date: '2026-03-01' }, // /1.10 = 100 EUR
      { amount: 120, currency: 'USD', date: '2026-03-02' }, // /1.20 = 100 EUR
    ];
    const { total, missing } = convertedTotal(entries, ratesByDate, 'EUR');
    expect(total).toBeCloseTo(300, 6);
    expect(missing).toBe(0);
  });

  it('counts entries whose date rates are unavailable and skips them', () => {
    const entries = [
      { amount: 100, currency: 'EUR', date: '2026-03-01' },
      { amount: 50,  currency: 'USD', date: '2099-01-01' }, // no rates for this date
      { amount: 10,  currency: 'JPY', date: '2026-03-01' }, // rate missing for JPY
    ];
    const { total, missing } = convertedTotal(entries, ratesByDate, 'EUR');
    expect(total).toBeCloseTo(100, 6); // only the EUR entry counted
    expect(missing).toBe(2);
  });
});

describe('convertShare', () => {
  const ratesByDate = { '2026-03-01': { USD: 1.10 } }; // base EUR
  const latest = { USD: 1.20 }; // base EUR

  it('passes through when already in the home currency', () => {
    expect(convertShare(100, 'EUR', '2026-03-01', ratesByDate, latest, 'EUR'))
      .toEqual({ amount: 100, estimated: false });
  });

  it('converts at the date rate when available (exact)', () => {
    const r = convertShare(110, 'USD', '2026-03-01', ratesByDate, latest, 'EUR');
    expect(r.amount).toBeCloseTo(100, 6); // 110 / 1.10
    expect(r.estimated).toBe(false);
  });

  it('falls back to the latest rate when the date is missing (estimated)', () => {
    const r = convertShare(120, 'USD', '2099-01-01', ratesByDate, latest, 'EUR');
    expect(r.amount).toBeCloseTo(100, 6); // 120 / 1.20 (latest)
    expect(r.estimated).toBe(true);
  });

  it('uses face value as a last resort for an unsupported currency (estimated)', () => {
    const r = convertShare(500, 'XYZ', '2026-03-01', ratesByDate, latest, 'EUR');
    expect(r.amount).toBe(500);
    expect(r.estimated).toBe(true);
  });
});

describe('perCurrencyText', () => {
  it('shows one currency as a single amount', () => {
    expect(perCurrencyText([{ amount: 200, currency: 'EUR' }, { amount: 100, currency: 'EUR' }], 'EUR')).toBe('€300.00');
  });

  it('keeps currencies apart, the trip\'s own first, never adding them together', () => {
    const text = perCurrencyText([{ amount: 12, currency: 'USD' }, { amount: 300, currency: 'EUR' }], 'EUR');
    expect(text).toBe('€300.00 + $12.00');
  });

  it('shows zero in the trip currency when there is nothing', () => {
    expect(perCurrencyText([], 'EUR')).toBe('€0.00');
  });
});

// #687: an expense keeps the rate for the date it's logged with, saved on it, so owed amounts never move.
describe('lockRate', () => {
  it('saves how many trip-currency units one unit of the expense currency is worth', () => {
    // base THB: 1 THB = 0.0297 USD, so 1 USD = 33.67 THB
    expect(lockRate('USD', 'THB', { USD: 0.0297 }, '2026-11-02')).toEqual({ to: 'THB', value: 1 / 0.0297, on: '2026-11-02' });
  });
  it('is null in the trip currency itself, or with no rate for that currency', () => {
    expect(lockRate('THB', 'THB', { USD: 0.0297 }, '2026-11-02')).toBeNull();
    expect(lockRate('VND', 'THB', { USD: 0.0297 }, '2026-11-02')).toBeNull();
    expect(lockRate('USD', 'THB', null, '2026-11-02')).toBeNull();
  });
});

describe('rateDay', () => {
  const day = (iso: string) => new Date(iso + 'T12:00:00').getTime();
  it('is the expense date when that has passed', () => {
    expect(rateDay({ date: '2026-10-30', createdAt: day('2026-11-01') }, '2026-11-03')).toBe('2026-10-30');
  });
  it('is the day it was entered when the expense is dated ahead', () => {
    expect(rateDay({ date: '2026-11-14', createdAt: day('2026-11-01') }, '2026-11-03')).toBe('2026-11-01');
  });
  it('is today for something dated today or entered today', () => {
    expect(rateDay({ date: '2026-11-03', createdAt: day('2026-11-03') }, '2026-11-03')).toBe('2026-11-03');
    expect(rateDay({ date: '2026-11-14', createdAt: day('2026-11-03') }, '2026-11-03')).toBe('2026-11-03');
  });
});

describe('a saved rate wins', () => {
  const rate = { to: 'EUR', value: 0.9, on: '2026-03-01' };
  it('in convertShare: exact, whatever today\'s rates say', () => {
    expect(convertShare(100, 'USD', '2026-03-01', { '2026-03-01': { USD: 1.5 } }, { USD: 2 }, 'EUR', rate))
      .toEqual({ amount: 90, estimated: false });
  });
  it('in convertedTotal', () => {
    const { total, missing } = convertedTotal([{ amount: 100, currency: 'USD', date: '2099-01-01', rate }], {}, 'EUR');
    expect(total).toBeCloseTo(90, 6);
    expect(missing).toBe(0);
  });
  it('is ignored once the trip\'s currency has changed', () => {
    expect(convertShare(110, 'USD', '2026-03-01', { '2026-03-01': { USD: 1.10 } }, null, 'EUR', { ...rate, to: 'GBP' }).amount)
      .toBeCloseTo(100, 6);
  });
});

describe('needsNewRate', () => {
  const before = { date: '2026-11-02', currency: 'USD' };
  it('is the new date and currency when either changes', () => {
    expect(needsNewRate(before, { date: '2026-11-01' })).toEqual({ date: '2026-11-01', currency: 'USD' });
    expect(needsNewRate(before, { currency: 'EUR' })).toEqual({ date: '2026-11-02', currency: 'EUR' });
  });
  it('is null for any other edit, or when nothing really changed', () => {
    expect(needsNewRate(before, { amount: 50 } as never)).toBeNull();
    expect(needsNewRate(before, { date: '2026-11-02', currency: 'USD' })).toBeNull();
  });
});

// #429: each person sees what's owed in their own currency too, converted from the trip's at today's rate.
describe('inOwnCurrency', () => {
  const latest = { GBP: 0.022, USD: 0.03 }; // base THB: 1 THB = 0.022 GBP
  it('converts a trip-currency amount into the person\'s own', () => {
    expect(inOwnCurrency(1000, 'THB', 'GBP', latest)).toEqual({ amount: 22, currency: 'GBP' });
  });
  it('is null with no currency of their own, the trip\'s own, or no rate yet', () => {
    expect(inOwnCurrency(1000, 'THB', undefined, latest)).toBeNull();
    expect(inOwnCurrency(1000, 'THB', 'THB', latest)).toBeNull();
    expect(inOwnCurrency(1000, 'THB', 'JPY', latest)).toBeNull();
    expect(inOwnCurrency(1000, 'THB', 'GBP', null)).toBeNull();
  });
});

// #719: every amount carries its currency, as a symbol where it has one.
describe('amountText', () => {
  it('puts the currency\'s symbol on the amount, always with cents', () => {
    expect(amountText(3840, 'THB')).toBe('฿3,840.00');
    expect(amountText(30, 'USD')).toBe('$30.00');
    expect(amountText(24.5, 'GBP')).toBe('£24.50');
  });
  it('uses the code where there is no symbol, or the code is unknown', () => {
    expect(amountText(10, 'CHF')).toBe('CHF 10.00');
    expect(amountText(10, 'XYZ')).toBe('XYZ 10.00');
  });
});

// #723: each expense keeps a rate for every currency the group uses, so amounts never move.
describe('saved rates for every group currency', () => {
  it('lists the trip currency and each member\'s, once each', () => {
    expect(groupCurrencies('THB', [{ ownCurrency: 'USD' }, {}, { ownCurrency: 'GBP' }, { ownCurrency: 'USD' }, { ownCurrency: 'THB' }])).toEqual(['THB', 'USD', 'GBP']);
  });
  it('keeps, from a table based on the expense currency, every wanted rate but its own', () => {
    // base USD: 1 USD = 33.5 THB = 0.79 GBP
    expect(lockRates('USD', ['THB', 'USD', 'GBP', 'JPY'], { THB: 33.5, GBP: 0.79 }, '2026-11-02'))
      .toEqual({ on: '2026-11-02', per: { THB: 33.5, GBP: 0.79 } });
    expect(lockRates('USD', ['THB'], null, '2026-11-02')).toBeNull();
  });
  it('says which group currencies an expense is missing', () => {
    expect(missingRates({ currency: 'USD', rates: { on: '2026-11-02', per: { THB: 33.5 } } }, ['THB', 'USD', 'GBP'])).toEqual(['GBP']);
    expect(missingRates({ currency: 'THB' }, ['THB', 'USD'])).toEqual(['USD']);
  });
  it('adds rates it was missing without touching the ones it had', () => {
    expect(mergeRates({ on: '2026-11-02', per: { THB: 33.5 } }, { on: '2026-11-02', per: { THB: 99, GBP: 0.79 } }))
      .toEqual({ on: '2026-11-02', per: { THB: 33.5, GBP: 0.79 } });
    expect(mergeRates(undefined, { on: '2026-11-02', per: { GBP: 0.79 } })).toEqual({ on: '2026-11-02', per: { GBP: 0.79 } });
  });
});
