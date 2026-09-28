import { SignupFormState, SignupValues, EMAIL_EXISTS, USERNAME_TAKEN, usernameProblem } from './signup-form';

const good: SignupValues = {
  name: 'Seneca', username: 'senecasolt', email: 'seneca@example.com',
  password: 'Hunter22x', confirm: 'Hunter22x',
};

function state(taken: { usernames?: string[]; emails?: string[] } = {}) {
  const calls = { username: [] as string[], email: [] as string[] };
  const s = new SignupFormState({
    usernameExists: async (u) => { calls.username.push(u); return (taken.usernames ?? []).includes(u); },
    emailExists:    async (e) => { calls.email.push(e);    return (taken.emails ?? []).includes(e); },
  });
  return { s, calls };
}

describe('SignupFormState', () => {
  it('shows nothing until a field has been touched', () => {
    const { s } = state();
    const v = { ...good, name: '', email: 'nope' };
    expect(s.error('name', v)).toBe('');
    expect(s.error('email', v)).toBe('');
  });

  it('flags an empty field once the user taps away from it', async () => {
    const { s } = state();
    await s.blur('name', { ...good, name: '   ' });
    expect(s.error('name', { ...good, name: '   ' })).toBe("Name can't be empty.");
    await s.blur('username', { ...good, username: '' });
    expect(s.error('username', { ...good, username: '' })).toBe("Username can't be empty.");
    await s.blur('email', { ...good, email: '' });
    expect(s.error('email', { ...good, email: '' })).toBe("Email can't be empty.");
    await s.blur('password', { ...good, password: '' });
    expect(s.error('password', { ...good, password: '' })).toBe("Password can't be empty.");
    await s.blur('confirm', { ...good, confirm: '' });
    expect(s.error('confirm', { ...good, confirm: '' })).toBe('Please confirm your password.');
  });

  it('requires an email-shaped address', async () => {
    const { s } = state();
    const v = { ...good, email: 'seneca.example.com' };
    await s.blur('email', v);
    expect(s.error('email', v)).toBe('Enter a valid email address.');
  });

  it('rejects spaces in a username', async () => {
    const { s } = state();
    const v = { ...good, username: 'seneca solt' };
    await s.blur('username', v);
    expect(s.error('username', v)).toBe("Username can't contain spaces.");
  });

  it('reports a username that already exists, ignoring case and spaces around it', async () => {
    const { s, calls } = state({ usernames: ['senecasolt'] });
    const v = { ...good, username: '  SenecaSolt ' };
    await s.blur('username', v);
    expect(calls.username).toEqual(['senecasolt']);
    expect(s.error('username', v)).toBe(USERNAME_TAKEN);
    // typing a different one clears it without another lookup
    expect(s.error('username', { ...good, username: 'senecasolt2' })).toBe('');
  });

  it('reports an email that already has an account', async () => {
    const { s } = state({ emails: ['seneca@example.com'] });
    await s.blur('email', good);
    expect(s.error('email', good)).toBe(EMAIL_EXISTS);
    expect(s.isValid(good)).toBeFalse();
  });

  it('does not look up values that fail the basic checks', async () => {
    const { s, calls } = state();
    await s.blur('username', { ...good, username: '' });
    await s.blur('email', { ...good, email: 'not-an-email' });
    expect(calls.username).toEqual([]);
    expect(calls.email).toEqual([]);
  });

  it('flags a mismatch while the user is still typing the confirmation', () => {
    const { s } = state();
    expect(s.error('confirm', { ...good, confirm: 'Hunt' })).toBe("Passwords don't match.");
    expect(s.error('confirm', good)).toBe('');
  });

  it('lists what a weak password is missing', async () => {
    const { s } = state();
    const v = { ...good, password: 'short', confirm: 'short' };
    await s.blur('password', v);
    expect(s.error('password', v)).toBe('Password needs: at least 8 characters, an uppercase letter, a number.');
  });

  it('is valid only when every field passes and nothing is taken', async () => {
    const { s } = state();
    expect(s.isValid({ ...good, name: '' })).toBeFalse();
    expect(s.isValid({ ...good, email: 'bad' })).toBeFalse();
    expect(s.isValid({ ...good, password: 'weak', confirm: 'weak' })).toBeFalse();
    expect(s.isValid({ ...good, confirm: 'Different1' })).toBeFalse();
    expect(s.isValid(good)).toBeTrue();
    const taken = state({ usernames: ['senecasolt'] });
    await taken.s.blur('username', good);
    expect(taken.s.isValid(good)).toBeFalse();
  });

  it('touchAll surfaces every error at once (submit with blanks)', () => {
    const { s } = state();
    const v: SignupValues = { name: '', username: '', email: '', password: '', confirm: '' };
    s.touchAll();
    expect(s.error('name', v)).toBe("Name can't be empty.");
    expect(s.error('email', v)).toBe("Email can't be empty.");
    expect(s.error('password', v)).toBe("Password can't be empty.");
  });
});

describe('SignupFormState.problems (summary above the submit button)', () => {
  it('lists one plain line per field that still needs fixing, in form order', async () => {
    const { s } = state({ usernames: ['taken'] });
    const v: SignupValues = { name: '', username: 'taken', email: 'bad', password: 'weak', confirm: 'other' };
    await s.blur('username', v);
    expect(s.problems(v)).toEqual([
      'Enter your name.',
      'That username is taken.',
      'Enter a valid email address.',
      "Password doesn't meet the requirements.",
      "Passwords don't match.",
    ]);
  });

  it('names an email that already has an account and an empty confirmation', async () => {
    const { s } = state({ emails: ['seneca@example.com'] });
    const v = { ...good, confirm: '' };
    await s.blur('email', v);
    expect(s.problems(v)).toEqual(['Email already exists.', 'Confirm your password.']);
  });

  it('is empty when the form is valid', () => {
    expect(state().s.problems(good)).toEqual([]);
  });
});

describe('usernameProblem', () => {
  it('accepts lowercase letters, digits, dots, underscores and hyphens, 3–20 long', () => {
    for (const u of ['abc', 'seneca.solt', 'jordan_s-2', 'a'.repeat(20), '  Mixed.Case ']) {
      expect(usernameProblem(u)).withContext(u).toBe('');
    }
  });

  it('names each rule that is broken', () => {
    expect(usernameProblem('')).toBe("Username can't be empty.");
    expect(usernameProblem('sen eca')).toBe("Username can't contain spaces.");
    expect(usernameProblem('ab')).toBe('Username must be 3–20 characters.');
    expect(usernameProblem('a'.repeat(21))).toBe('Username must be 3–20 characters.');
    expect(usernameProblem('seneca!')).toBe('Use only letters, numbers, dots, underscores and hyphens.');
    expect(usernameProblem('sen@eca')).toBe('Use only letters, numbers, dots, underscores and hyphens.');
    expect(usernameProblem('🌸🌸🌸')).toBe('Use only letters, numbers, dots, underscores and hyphens.');
  });

  it('is what the signup form uses for the username field', async () => {
    const { s } = state();
    const v = { ...good, username: 'a!' };
    await s.blur('username', v);
    expect(s.error('username', v)).toBe('Username must be 3–20 characters.');
    expect(s.problems(v)).toEqual(['Username must be 3–20 characters.']);
  });
});
