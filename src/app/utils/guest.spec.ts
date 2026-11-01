import { guestAvatar, guestName } from './guest';
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
