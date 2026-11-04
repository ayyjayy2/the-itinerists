import { claimText, claimAnswerText, canRemind, cleanHandles, remindersOpen, normalizeHandle, payAmount, payLink, payAppLink, reminderText, REMINDER_GAP_MS } from './pay-links';

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
    expect(payLink('venmo', 'maya', 40, 'USD', 'Chiang Mai')).toBe('https://venmo.com/u/maya?txn=pay&amount=40.00&note=Chiang%20Mai');
    expect(payLink('venmo', 'maya', 40, 'EUR')).toBe('https://venmo.com/u/maya?txn=pay');
    expect(payLink('paypal', 'maya', 12.5, 'EUR')).toBe('https://paypal.me/maya/12.50EUR');
    expect(payLink('cashapp', 'maya', 40, 'GBP')).toBe('https://cash.app/$maya/40.00');
    expect(payLink('cashapp', 'maya', 40, 'THB')).toBe('https://cash.app/$maya');
  });

  // #676: Venmo showed "Chiang+Mai,+November": it doesn't read '+' as a space.
  it('writes spaces in the Venmo note as %20, keeping a real + as %2B', () => {
    expect(payLink('venmo', '', 40, 'USD', 'Chiang Mai, November')).toBe('https://venmo.com/?txn=pay&amount=40.00&note=Chiang%20Mai%2C%20November');
    expect(payLink('venmo', 'maya', 40, 'USD', 'Jo + Sam')).toBe('https://venmo.com/u/maya?txn=pay&amount=40.00&note=Jo%20%2B%20Sam');
  });

  // #681: the venmo.com link went through Safari (a prompt, and '+' back in the note); the app link opens Venmo directly.
  it('builds the Venmo app link, with the friend when they have a handle', () => {
    expect(payAppLink('venmo', 'maya', 40, 'USD', 'Chiang Mai, November'))
      .toBe('venmo://paycharge?txn=pay&recipients=maya&amount=40.00&note=Chiang%20Mai%2C%20November');
    expect(payAppLink('venmo', '', 40, 'USD', 'Lisbon')).toBe('venmo://paycharge?txn=pay&amount=40.00&note=Lisbon');
    expect(payAppLink('venmo', 'maya', 40, 'EUR')).toBe('venmo://paycharge?txn=pay&recipients=maya');
  });
  it('has no app link for PayPal or Cash App (neither fills anything in)', () => {
    expect(payAppLink('paypal', 'maya', 40, 'USD')).toBeNull();
    expect(payAppLink('cashapp', 'maya', 40, 'USD')).toBeNull();
  });

  it('opens the app’s own pay screen when the friend has no handle saved (#666)', () => {
    expect(payLink('venmo', '', 40, 'USD', 'Chiang Mai')).toBe('https://venmo.com/?txn=pay&amount=40.00&note=Chiang%20Mai');
    expect(payLink('paypal', '', 40, 'EUR')).toBe('https://www.paypal.com/myaccount/transfer/homepage/pay');
    expect(payLink('cashapp', '', 40, 'USD')).toBe('https://cash.app/');
  });

  it('converts the amount to a currency the app takes (#666)', () => {
    const rates = { USD: 0.0286, GBP: 0.0221 };   // per 1 THB
    expect(payAmount('paypal', 6160, 'THB', rates)).toEqual({ amount: 6160, currency: 'THB' });
    expect(payAmount('venmo', 40, 'USD', rates)).toEqual({ amount: 40, currency: 'USD' });
    expect(payAmount('venmo', 6160, 'THB', rates)).toEqual({ amount: 176.18, currency: 'USD' });
    expect(payAmount('cashapp', 6160, 'THB', rates)).toEqual({ amount: 176.18, currency: 'USD' });
    expect(payAmount('cashapp', 30, 'GBP', rates)).toEqual({ amount: 30, currency: 'GBP' });
    expect(payAmount('venmo', 6160, 'THB', null)).toBeNull();   // no rate yet: the app opens without an amount
  });

  // #688: the app gets the amount in the payer's own currency when it takes that currency.
  it('sends the payer\'s own currency when the app takes it', () => {
    const rates = { USD: 0.0286, GBP: 0.0221 };   // per 1 THB
    expect(payAmount('paypal', 6160, 'THB', rates, 'GBP')).toEqual({ amount: 136.14, currency: 'GBP' });
    expect(payAmount('cashapp', 6160, 'THB', rates, 'GBP')).toEqual({ amount: 136.14, currency: 'GBP' });
    expect(payAmount('venmo', 6160, 'THB', rates, 'GBP')).toEqual({ amount: 176.18, currency: 'USD' });   // Venmo: dollars only
    expect(payAmount('paypal', 6160, 'THB', rates, 'THB')).toEqual({ amount: 6160, currency: 'THB' });
    expect(payAmount('paypal', 6160, 'THB', rates, 'JPY')).toEqual({ amount: 6160, currency: 'THB' });   // no rate for it
  });

  // #716: each step of "Mark as paid" reaches the other person's bell (the name comes first, on the bell).
  it('words the payment notices for the other person', () => {
    const plain = (t: string) => t.replace(/\u00a0/g, ' ');   // currency formatting uses a non-breaking space
    expect(plain(claimText(3112.5, 'THB', 'Venmo'))).toBe('says they paid you THB 3,112.50 with Venmo. Confirm it in Finance.');
    expect(plain(claimAnswerText('received', 3112.5, 'THB'))).toBe('got your THB 3,112.50 payment. You two are settled up.');
    expect(plain(claimAnswerText('not-received', 3112.5, 'THB'))).toBe('hasn’t received your THB 3,112.50 payment yet. Check the app you paid with, then mark it paid again.');
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

  it('opens reminders on the trip’s last day, not before (#664)', () => {
    expect(remindersOpen('2026-11-19', '2026-11-02')).toBeFalse();
    expect(remindersOpen('2026-11-19', '2026-11-18')).toBeFalse();
    expect(remindersOpen('2026-11-19', '2026-11-19')).toBeTrue();
    expect(remindersOpen('2026-11-19', '2026-12-01')).toBeTrue();
    expect(remindersOpen(undefined, '2026-11-02')).toBeTrue();   // no dates: nothing to wait for
  });
});
