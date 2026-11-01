import { canRemind, cleanHandles, normalizeHandle, payLink, reminderText, REMINDER_GAP_MS } from './pay-links';

describe('pay-links (#532)', () => {
  it('tidies typed handles and pasted profile links', () => {
    expect(normalizeHandle('venmo', '@maya-lopez')).toBe('maya-lopez');
    expect(normalizeHandle('venmo', 'https://venmo.com/u/maya_l')).toBe('maya_l');
    expect(normalizeHandle('paypal', 'paypal.me/MayaL')).toBe('MayaL');
    expect(normalizeHandle('paypal', 'https://www.paypal.com/paypalme/mayal/20')).toBe('mayal');
    expect(normalizeHandle('cashapp', '$maya')).toBe('maya');
    expect(normalizeHandle('cashapp', 'https://cash.app/$maya')).toBe('maya');
  });

  it('refuses anything that is not a plain handle', () => {
    expect(normalizeHandle('venmo', 'maya lopez')).toBe('');
    expect(normalizeHandle('venmo', 'javascript:alert(1)')).toBe('');
    expect(normalizeHandle('paypal', 'x'.repeat(41))).toBe('');
    expect(cleanHandles({ venmo: '@maya', paypal: 'bad handle', cashapp: '' })).toEqual({ venmo: 'maya' });
  });

  it('fills in the amount where the app takes that currency', () => {
    expect(payLink('venmo', 'maya', 40, 'USD', 'Chiang Mai')).toBe('https://venmo.com/u/maya?txn=pay&amount=40.00&note=Chiang+Mai');
    expect(payLink('venmo', 'maya', 40, 'EUR')).toBe('https://venmo.com/u/maya?txn=pay');
    expect(payLink('paypal', 'maya', 12.5, 'EUR')).toBe('https://paypal.me/maya/12.50EUR');
    expect(payLink('cashapp', 'maya', 40, 'GBP')).toBe('https://cash.app/$maya/40.00');
    expect(payLink('cashapp', 'maya', 40, 'THB')).toBe('https://cash.app/$maya');
  });

  it('words the reminder from the payer’s side', () => {
    expect(reminderText('Maya', 40, 'USD')).toBe("Don't forget to pay Maya: $40.00");
  });

  it('allows one reminder a day per pair', () => {
    const now = Date.UTC(2026, 10, 1, 12);
    expect(canRemind(undefined, now)).toBeTrue();
    expect(canRemind(now - 60_000, now)).toBeFalse();
    expect(canRemind(now - REMINDER_GAP_MS, now)).toBeTrue();
  });
});
