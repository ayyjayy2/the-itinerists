import { sanitizeStrings } from './sanitize';

describe('sanitizeStrings', () => {
  it('trims strings and drops blank entries from string lists', () => {
    expect(sanitizeStrings({ name: '  Pai  ', tags: [' a ', '  ', 'b'], n: 3 })).toEqual({ name: 'Pai', tags: ['a', 'b'], n: 3 });
  });

  // #731: a field left out (undefined) made Firestore refuse the whole save; it's dropped instead.
  it('leaves out keys whose value is undefined, and keeps the rest', () => {
    const out = sanitizeStrings({ vendor: undefined, description: ' Taxi ', amount: 12 });
    expect(out).toEqual({ description: 'Taxi', amount: 12 } as never);
    expect('vendor' in out).toBeFalse();
  });
});
