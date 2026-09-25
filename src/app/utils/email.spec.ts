import { maskEmail, isValidEmail, isPlaceholderEmail, needsRecoveryEmail, authEmailPatch } from './email';

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

describe('authEmailPatch', () => {
  it('mirrors a changed Auth email onto the account and clears a matching pending email', () => {
    expect(authEmailPatch('laura@example.com', { authEmail: 'laura@the-itinerists.local', pendingEmail: 'laura@example.com' }))
      .toEqual({ authEmail: 'laura@example.com', pendingEmail: '' });
  });

  it('keeps an unrelated pending email while mirroring', () => {
    expect(authEmailPatch('laura@example.com', { authEmail: 'old@example.com', pendingEmail: 'new@example.com' }))
      .toEqual({ authEmail: 'laura@example.com' });
  });

  it('returns null when nothing needs to change', () => {
    expect(authEmailPatch('laura@example.com', { authEmail: 'laura@example.com' })).toBeNull();
    expect(authEmailPatch('laura@example.com', { authEmail: 'LAURA@example.com' })).toBeNull();
    expect(authEmailPatch(null, { authEmail: 'x@y.z' })).toBeNull();
    expect(authEmailPatch('laura@example.com', null)).toBeNull();
  });
});
