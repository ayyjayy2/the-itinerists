import { requireSignupEmail } from './auth.service';

describe('requireSignupEmail', () => {
  it('lets a real address through', () => {
    expect(() => requireSignupEmail('seneca@example.com')).not.toThrow();
    expect(() => requireSignupEmail('  seneca@example.com  ')).not.toThrow();
  });
  it('refuses an empty, malformed or placeholder address', () => {
    for (const bad of ['', '   ', null, undefined, 'seneca', 'seneca@', 'seneca@the-itinerists.local']) {
      expect(() => requireSignupEmail(bad as any)).withContext(String(bad)).toThrowError('Enter a valid email address.');
    }
  });
});
