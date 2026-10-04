import { SignupFormState, SignupValues } from './signup-form';

const good: SignupValues = {
  name: 'Seneca', email: 'seneca@example.com',
  password: 'Hunter22x', confirm: 'Hunter22x',
};

describe('SignupFormState', () => {
  it('shows nothing until a field has been touched', () => {
    const s = new SignupFormState();
    const v = { ...good, name: '', email: 'nope' };
    expect(s.error('name', v)).toBe('');
    expect(s.error('email', v)).toBe('');
  });

  it('flags an empty field once the user taps away from it', () => {
    const s = new SignupFormState();
    s.blur('name');
    expect(s.error('name', { ...good, name: '   ' })).toBe("Name can't be empty.");
    s.blur('email');
    expect(s.error('email', { ...good, email: '' })).toBe("Email can't be empty.");
    s.blur('password');
    expect(s.error('password', { ...good, password: '' })).toBe("Password can't be empty.");
    s.blur('confirm');
    expect(s.error('confirm', { ...good, confirm: '' })).toBe('Please confirm your password.');
  });

  it('requires an email-shaped address', () => {
    const s = new SignupFormState();
    s.blur('email');
    expect(s.error('email', { ...good, email: 'seneca.example.com' })).toBe('Enter a valid email address.');
  });

  it('flags a mismatch while the user is still typing the confirmation', () => {
    const s = new SignupFormState();
    expect(s.error('confirm', { ...good, confirm: 'Hunt' })).toBe("Passwords don't match.");
    expect(s.error('confirm', good)).toBe('');
  });

  it('lists what a weak password is missing', () => {
    const s = new SignupFormState();
    s.blur('password');
    expect(s.error('password', { ...good, password: 'short', confirm: 'short' }))
      .toBe('Password needs: at least 8 characters, an uppercase letter, a number.');
  });

  it('is valid only when every field passes', () => {
    const s = new SignupFormState();
    expect(s.isValid({ ...good, name: '' })).toBeFalse();
    expect(s.isValid({ ...good, email: 'bad' })).toBeFalse();
    expect(s.isValid({ ...good, password: 'weak', confirm: 'weak' })).toBeFalse();
    expect(s.isValid({ ...good, confirm: 'Different1' })).toBeFalse();
    expect(s.isValid(good)).toBeTrue();
  });

  it('touchAll surfaces every error at once (submit with blanks)', () => {
    const s = new SignupFormState();
    const v: SignupValues = { name: '', email: '', password: '', confirm: '' };
    s.touchAll();
    expect(s.error('name', v)).toBe("Name can't be empty.");
    expect(s.error('email', v)).toBe("Email can't be empty.");
    expect(s.error('password', v)).toBe("Password can't be empty.");
  });
});

describe('SignupFormState.problems (summary above the submit button)', () => {
  it('lists one plain line per field that still needs fixing, in form order', () => {
    const v: SignupValues = { name: '', email: 'bad', password: 'weak', confirm: 'other' };
    expect(new SignupFormState().problems(v)).toEqual([
      'Enter your name.',
      'Enter a valid email address.',
      "Password doesn't meet the requirements.",
      "Passwords don't match.",
    ]);
  });

  it('names an empty confirmation plainly', () => {
    expect(new SignupFormState().problems({ ...good, confirm: '' })).toEqual(['Confirm your password.']);
  });

  it('is empty when the form is valid', () => {
    expect(new SignupFormState().problems(good)).toEqual([]);
  });
});
