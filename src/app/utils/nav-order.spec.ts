import { applyNavOrder } from './nav-order';

const items = [
  { path: '/a', label: 'A' },
  { path: '/b', label: 'B' },
  { path: '/c', label: 'C' },
];

describe('applyNavOrder', () => {
  it('returns the default order when no preference is saved', () => {
    expect(applyNavOrder(items, undefined).map(i => i.path)).toEqual(['/a', '/b', '/c']);
    expect(applyNavOrder(items, []).map(i => i.path)).toEqual(['/a', '/b', '/c']);
  });

  it('sorts by the saved order', () => {
    expect(applyNavOrder(items, ['/c', '/a', '/b']).map(i => i.path)).toEqual(['/c', '/a', '/b']);
  });

  it('appends items missing from the saved order in default relative order', () => {
    expect(applyNavOrder(items, ['/c']).map(i => i.path)).toEqual(['/c', '/a', '/b']);
  });

  it('ignores saved paths that no longer exist', () => {
    expect(applyNavOrder(items, ['/gone', '/b']).map(i => i.path)).toEqual(['/b', '/a', '/c']);
  });
});
