import { cspViolationMessage } from './csp-violation';

describe('cspViolationMessage (#445)', () => {
  it('names the rule and only the blocked host, never the path or query (they can carry tokens)', () => {
    expect(cspViolationMessage({ effectiveDirective: 'connect-src', blockedURI: 'https://www.google.com/recaptcha/api2/clr?k=SECRETISH&x=1' }))
      .toBe('connect-src blocked www.google.com');
  });

  it('describes inline code and odd values without crashing', () => {
    expect(cspViolationMessage({ effectiveDirective: 'script-src-elem', blockedURI: 'inline' })).toBe('script-src-elem blocked inline');
    expect(cspViolationMessage({ effectiveDirective: 'img-src', blockedURI: 'data' })).toBe('img-src blocked data');
    expect(cspViolationMessage({ effectiveDirective: '', blockedURI: '' })).toBe('unknown blocked unknown');
  });
});
