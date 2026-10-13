import { markId, paidKey, parsePaidKey, ticksToShare } from './paid-marks';

describe('paid marks (#448)', () => {
  it('keeps the key Finance already uses: from__to__itemId', () => {
    expect(paidKey('Maya', 'Theo', 'e1')).toBe('Maya__Theo__e1');
  });

  it('reads a key back, including names with spaces', () => {
    expect(parsePaidKey('Jo Ana__Theo B__abc123')).toEqual({ from: 'Jo Ana', to: 'Theo B', itemId: 'abc123' });
    expect(parsePaidKey('not a key')).toBeNull();
  });

  it('turns a key into a safe record id: no slashes, never a reserved __name__ id', () => {
    const id = markId('A/B__C__e1');
    expect(id).not.toContain('/');
    expect(id).not.toMatch(/^__.*__$/);
    expect(markId('Maya__Theo__e1')).toBe(markId('Maya__Theo__e1'));   // stable
    expect(markId('Maya__Theo__e1')).not.toBe(markId('Theo__Maya__e1')); // direction matters
  });

  it('only the device ticks the trip does not have yet are copied over', () => {
    const shared = new Set(['Maya__Theo__e1']);
    expect(ticksToShare(['Maya__Theo__e1', 'Jo__Theo__e2', 'junk'], shared)).toEqual(['Jo__Theo__e2']);
    expect(ticksToShare([], shared)).toEqual([]);
  });
});
