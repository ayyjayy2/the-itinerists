import { callingApp, callingNote, countryOf, telTarget } from './calling-app';

describe('calling app (#611)', () => {
  it('finds the country in a destination', () => {
    expect(countryOf('Chiang Mai, Thailand')).toBe('Thailand');
    expect(countryOf('Lisbon')).toBe('');
  });

  it('names the app people use there, WhatsApp by default', () => {
    expect(callingApp('Thailand')).toBe('LINE');
    expect(callingApp('japan')).toBe('LINE');
    expect(callingApp('South Korea')).toBe('KakaoTalk');
    expect(callingApp('China')).toBe('WeChat');
    expect(callingApp('Vietnam')).toBe('Zalo');
    expect(callingApp('Portugal')).toBe('WhatsApp');
    expect(callingApp('')).toBe('WhatsApp');
  });

  it('words the note', () => {
    expect(callingNote('Thailand')).toBe('Calling from abroad? Try LINE, which most people in Thailand use.');
    expect(callingNote('')).toBe('Calling from abroad? Try WhatsApp.');
  });

  it('makes a safe tel: target from what was typed', () => {
    expect(telTarget('+66 (53) 123-456')).toBe('+6653123456');
    expect(telTarget('053 123 456 ext. 2')).toBe('0531234562');
    expect(telTarget('javascript:alert(1)')).toBe('1');
  });
});
