import { starterLetters, ALL_LETTERS, isLetterAvatar } from './avatar-letters';

describe('isLetterAvatar', () => {
  it('is true only for a single A–Z character', () => {
    expect(isLetterAvatar('J')).toBeTrue();
    expect(isLetterAvatar('🌿')).toBeFalse();
    expect(isLetterAvatar('JJ')).toBeFalse();
    expect(isLetterAvatar('')).toBeFalse();
  });
});

describe('ALL_LETTERS', () => {
  it('is A through Z', () => {
    expect(ALL_LETTERS.length).toBe(26);
    expect(ALL_LETTERS[0]).toBe('A');
    expect(ALL_LETTERS[25]).toBe('Z');
  });
});

describe('starterLetters', () => {
  it('leads with the initials of the display name, then fills alphabetically', () => {
    expect(starterLetters('Alayna Johnston', 6)).toEqual(['A', 'J', 'B', 'C', 'D', 'E']);
  });

  it('falls back to the alphabet when there is no name', () => {
    expect(starterLetters('', 4)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('upper-cases and de-duplicates initials', () => {
    expect(starterLetters('bob barker', 3)).toEqual(['B', 'A', 'C']);
  });

  it('ignores non-letter initials', () => {
    expect(starterLetters('123 Élan', 3)).toEqual(['A', 'B', 'C']);
  });

  it('never returns more than the requested count', () => {
    expect(starterLetters('One Two Three Four', 2)).toEqual(['O', 'T']);
  });
});
