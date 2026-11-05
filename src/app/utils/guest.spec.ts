import { guestAvatar, guestName, nameClash, returnedGuests } from './guest';
import { BACKGROUND_COLORS } from './avatar-contrast';

describe('guest helpers (#610)', () => {
  it('makes a letter avatar from the name, the same each time', () => {
    const a = guestAvatar('maya');
    expect(a.avatarEmoji).toBe('M');
    expect(BACKGROUND_COLORS).toContain(a.color);
    expect(a.avatarLetterColor).toMatch(/^#/);
    expect(guestAvatar('Maya ')).toEqual(guestAvatar('maya'));
  });

  it('uses the first letter after accents and symbols', () => {
    expect(guestAvatar('  Élise').avatarEmoji).toBe('E');
    expect(guestAvatar('@jo').avatarEmoji).toBe('J');
  });

  it('smiles for a name with no A–Z letter', () => {
    expect(guestAvatar('李雷').avatarEmoji).toBe('🙂');
  });

  it('tidies the typed name', () => {
    expect(guestName('  Maya   Lopez ')).toBe('Maya Lopez');
    expect(guestName('x'.repeat(60)).length).toBe(40);
  });
});

/** #768, #776: a guest who joins with a name already on the trip. */
describe('nameClash', () => {
  const members = [
    { uid: 'm', displayName: 'Maya' },
    { uid: 'old', displayName: 'Robin', leftAt: 1 },
    { uid: 'stayed', displayName: 'Sam', isGuest: true },
    { uid: 'me', displayName: 'robin', isGuest: true },
  ];
  it('finds someone else with the same name, whatever the case, and says whether they are a guest', () => {
    expect(nameClash('robin', 'me', members)).toEqual({ uid: 'old', name: 'Robin', guest: true });
    expect(nameClash('sam', 'me', members)).toEqual({ uid: 'stayed', name: 'Sam', guest: true });   // never logged out (#776)
    expect(nameClash(' maya ', 'me', members)).toEqual({ uid: 'm', name: 'Maya', guest: false });
  });
  it('is null when the name is free (they never clash with themselves)', () => {
    expect(nameClash('Robin B', 'me', members)).toBeNull();
    expect(nameClash('robin', 'old', [{ uid: 'old', displayName: 'Robin' }])).toBeNull();
  });
});

describe('returnedGuests', () => {
  it('is an earlier guest under a name someone joined with again: shown once, newest kept', () => {
    const back = returnedGuests([
      { uid: 'old', displayName: 'Robin', leftAt: 1, joinedAt: 1 },
      { uid: 'new', displayName: 'Robin', isGuest: true, joinedAt: 3 },
      { uid: 'closed', displayName: 'Sam', isGuest: true, joinedAt: 1 },
      { uid: 'again', displayName: 'sam', isGuest: true, joinedAt: 2 },
      { uid: 'gone', displayName: 'Jo', leftAt: 1, joinedAt: 1 },
    ]);
    expect([...back].sort()).toEqual(['closed', 'old']);
  });
  it('never hides someone with an account', () => {
    expect([...returnedGuests([
      { uid: 'acct', displayName: 'Maya', joinedAt: 1 },
      { uid: 'g', displayName: 'Maya', isGuest: true, joinedAt: 2 },
    ])]).toEqual([]);
  });
});
