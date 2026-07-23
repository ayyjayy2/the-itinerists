import { passwordRules, isPasswordValid, passwordProblems } from './password';

describe('password policy util', () => {
  it('accepts a password meeting all rules', () => {
    expect(isPasswordValid('Abcdef12')).toBe(true);
    expect(passwordProblems('Abcdef12')).toBe('');
  });

  it('rejects a too-short password and says so', () => {
    expect(isPasswordValid('Ab1')).toBe(false);
    expect(passwordProblems('Ab1')).toContain('at least 8 characters');
  });

  it('rejects when missing an uppercase letter', () => {
    expect(isPasswordValid('abcdef12')).toBe(false);
    expect(passwordProblems('abcdef12')).toContain('an uppercase letter');
  });

  it('rejects when missing a lowercase letter', () => {
    expect(isPasswordValid('ABCDEF12')).toBe(false);
    expect(passwordProblems('ABCDEF12')).toContain('a lowercase letter');
  });

  it('rejects when missing a number', () => {
    expect(isPasswordValid('Abcdefgh')).toBe(false);
    expect(passwordProblems('Abcdefgh')).toContain('a number');
  });

  it('lists every unmet rule at once', () => {
    // "aaaa" — has lowercase; missing length, uppercase, number
    const rules = passwordRules('aaaa');
    expect(rules.filter(r => !r.met).map(r => r.label)).toEqual([
      'At least 8 characters', 'An uppercase letter', 'A number',
    ]);
  });
});
