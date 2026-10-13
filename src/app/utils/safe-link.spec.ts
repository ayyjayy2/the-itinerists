import { safeLink } from './safe-link';

describe('safeLink', () => {
  it('keeps web, email and phone links', () => {
    expect(safeLink('https://booking.com/x?y=1')).toBe('https://booking.com/x?y=1');
    expect(safeLink('http://example.com')).toBe('http://example.com/');
    expect(safeLink('mailto:host@example.com')).toBe('mailto:host@example.com');
    expect(safeLink('tel:+351 912 345 678')).toBe('tel:+351 912 345 678');
  });

  it('adds https:// to a bare web address, as people often paste one', () => {
    expect(safeLink('booking.com/hotel/pt/abc')).toBe('https://booking.com/hotel/pt/abc');
    expect(safeLink('  www.airbnb.com/rooms/1  ')).toBe('https://www.airbnb.com/rooms/1');
  });

  it('refuses anything that could run code or open something unexpected', () => {
    for (const bad of [
      'javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)',
      'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', 'file:///etc/passwd',
      'blob:https://x/1', 'about:blank', 'intent://x#Intent;end',
    ]) expect(safeLink(bad)).withContext(bad).toBeNull();
  });

  it('refuses empty or meaningless input', () => {
    for (const bad of ['', '   ', undefined, null, 'not a link', 'https://', '//evil.example']) expect(safeLink(bad)).withContext(String(bad)).toBeNull();
  });
});
