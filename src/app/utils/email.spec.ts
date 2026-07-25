import { maskEmail } from './email';

describe('maskEmail', () => {
  it('masks the local part, keeping first char and domain', () => {
    expect(maskEmail('makaela@gmail.com')).toBe('m•••@gmail.com');
  });

  it('handles a one-char local part', () => {
    expect(maskEmail('a@b.co')).toBe('a•••@b.co');
  });

  it('returns input unchanged when there is no @', () => {
    expect(maskEmail('not-an-email')).toBe('not-an-email');
  });
});
