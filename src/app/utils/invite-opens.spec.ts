import { firstOpen, visitorId } from './invite-opens';

function memory(): Pick<Storage, 'getItem' | 'setItem'> & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}

describe('invite opens (#609)', () => {
  it('keeps one visitor id per device', () => {
    const store = memory();
    let n = 0;
    const make = () => `0000000${++n}-aaaa`;
    const first = visitorId(store, make);
    expect(visitorId(store, make)).toBe(first);
    expect(n).toBe(1);
  });

  it('makes a fresh id when storage is missing or holds junk', () => {
    expect(visitorId(null, () => 'abcdef12')).toBe('abcdef12');
    const store = memory();
    store.data['itinerists.visitor'] = '<script>';
    expect(visitorId(store, () => 'abcdef12')).toBe('abcdef12');
  });

  it('counts a device once per trip', () => {
    const store = memory();
    expect(firstOpen(store, 'trip-a')).toBeTrue();
    expect(firstOpen(store, 'trip-a')).toBeFalse();
    expect(firstOpen(store, 'trip-b')).toBeTrue();
  });

  it('still counts when storage throws', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(firstOpen(broken, 'trip-a')).toBeTrue();
  });
});
