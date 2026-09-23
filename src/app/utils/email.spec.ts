import { maskEmail, isValidEmail, isPlaceholderEmail, needsRecoveryEmail } from './email';

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('makaela@gmail.com')).toBe('m•••@gmail.com');
  });

  it('handles a one-char local part', () => {
    expect(maskEmail('a@b.co')).toBe('a•••@b.co');
  });

  it('leaves strings without an @ alone', () => {
    expect(maskEmail('nope')).toBe('nope');
  });
});

describe('isValidEmail', () => {
  it('accepts ordinary addresses, trimmed', () => {
    expect(isValidEmail('  alayna@example.com ')).toBeTrue();
    expect(isValidEmail('first.last+tag@sub.example.co')).toBeTrue();
  });

  it('rejects blanks, missing parts, and spaces', () => {
    expect(isValidEmail('')).toBeFalse();
    expect(isValidEmail('alayna')).toBeFalse();
    expect(isValidEmail('alayna@')).toBeFalse();
    expect(isValidEmail('@example.com')).toBeFalse();
    expect(isValidEmail('a b@example.com')).toBeFalse();
  });

  it('rejects the app\'s own placeholder domain', () => {
    expect(isValidEmail('nick@the-itinerists.local')).toBeFalse();
  });
});

describe('isPlaceholderEmail', () => {
  it('is true for the synthetic username address and for nothing at all', () => {
    expect(isPlaceholderEmail('nick@the-itinerists.local')).toBeTrue();
    expect(isPlaceholderEmail('')).toBeTrue();
    expect(isPlaceholderEmail(undefined)).toBeTrue();
  });

  it('is false for a real address', () => {
    expect(isPlaceholderEmail('nick@gmail.com')).toBeFalse();
  });
});

describe('needsRecoveryEmail', () => {
  it('flags accounts with no real email on file', () => {
    expect(needsRecoveryEmail({ authEmail: undefined })).toBeTrue();
    expect(needsRecoveryEmail({ authEmail: 'tico@the-itinerists.local' })).toBeTrue();
  });

  it('does not flag accounts that have one, or no account at all', () => {
    expect(needsRecoveryEmail({ authEmail: 'laura@example.com' })).toBeFalse();
    expect(needsRecoveryEmail(null)).toBeFalse();
  });
});
