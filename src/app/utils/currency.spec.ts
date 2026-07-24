import { convertAmount, perCurrencySubtotals, convertedTotal, convertShare } from './currency';

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
