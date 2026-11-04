import { landingSource, rememberLandingSource, sourceFromSearch } from './waitlist-source';

describe('waitlist-source', () => {
  function memory(): Storage {
    const m = new Map<string, string>();
    return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) } as Storage;
  }

  it('reads ?from= from a landing address, case and short forms included', () => {
    expect(sourceFromSearch('?from=instagram')).toBe('instagram');
    expect(sourceFromSearch('?from=IG')).toBe('instagram');
    expect(sourceFromSearch('?utm_x=1&from=LinkedIn')).toBe('linkedin');
    expect(sourceFromSearch('?from=li')).toBe('linkedin');
  });

  it('ignores anything else, including the survey (only the owner adds those)', () => {
    expect(sourceFromSearch('')).toBeNull();
    expect(sourceFromSearch('?from=survey')).toBeNull();
    expect(sourceFromSearch('?from=<script>')).toBeNull();
  });

  it('remembers the source for the visit, so it survives the redirect to /welcome', () => {
    const s = memory();
    rememberLandingSource('?from=instagram', s);
    expect(landingSource(s)).toBe('instagram');
  });

  it('is website when there was no source, and keeps an earlier one when a later address has none', () => {
    const s = memory();
    expect(landingSource(s)).toBe('website');
    rememberLandingSource('?from=linkedin', s);
    rememberLandingSource('', s);
    expect(landingSource(s)).toBe('linkedin');
  });

  it('falls back to website when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } as unknown as Storage;
    expect(() => rememberLandingSource('?from=ig', blocked)).not.toThrow();
    expect(landingSource(blocked)).toBe('website');
  });
});
