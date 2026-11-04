import { leaverItems, reviewOpen } from './leaver-review';

/** #747: what a guest who logged out was still in, for the group to check. */
describe('leaverItems', () => {
  const everyone = ['Maya', 'Theo', 'Robin'];
  const expense = (id: string, over: object = {}) => ({
    id, date: '2026-11-14', vendor: 'Dash!', description: 'Dinner', amount: 300, currency: 'THB',
    paidBy: 'Maya', splitAmong: 'All', splits: null, ...over,
  });
  const plan = (id: string, forWho: string) => ({ id, date: '2026-11-15', activity: 'Temples walk', forWho });

  it('lists expenses split with everyone, with their equal share', () => {
    const [item] = leaverItems('Robin', everyone, [expense('e1')], [], []);
    expect(item).toEqual(jasmine.objectContaining({ kind: 'expense', id: 'e1', title: 'Dash!', ways: 3, share: 100, currency: 'THB', paid: false }));
  });

  it('uses their own amount when the split is unequal, and names them when they paid', () => {
    const items = leaverItems('Robin', everyone, [
      expense('e1', { splitAmong: 'Maya, Robin', splits: { Maya: 200, Robin: 100 } }),
      expense('e2', { paidBy: 'Robin', splitAmong: 'Maya, Theo' }),
    ], [], []);
    expect(items.map(i => [i.id, i.share, i.paid])).toEqual([['e1', 100, false], ['e2', undefined, true]]);
  });

  it('leaves out expenses they are not in', () => {
    expect(leaverItems('Robin', everyone, [expense('e1', { splitAmong: 'Maya, Theo' })], [], [])).toEqual([]);
  });

  it('lists plans that name them, not plans for everyone', () => {
    const items = leaverItems('Robin', everyone, [], [plan('p1', 'Maya, Robin'), plan('p2', 'All'), plan('p3', 'Theo')], []);
    expect(items.map(i => [i.kind, i.id, i.title])).toEqual([['plan', 'p1', 'Temples walk']]);
  });

  it('drops what has been checked, and goes expenses first, each by date', () => {
    const items = leaverItems('Robin', everyone,
      [expense('late', { date: '2026-11-18' }), expense('early', { date: '2026-11-13' }), expense('done')],
      [plan('p1', 'Robin')], ['done']);
    expect(items.map(i => i.id)).toEqual(['early', 'late', 'p1']);
  });

  it('matches names exactly, so "Rob" is not "Robin"', () => {
    expect(leaverItems('Rob', ['Maya', 'Rob', 'Robin'], [expense('e1', { splitAmong: 'Maya, Robin' })], [], [])).toEqual([]);
  });
});

describe('reviewOpen', () => {
  it('is open until Looks right, while anything is left to check', () => {
    expect(reviewOpen(undefined, 2)).toBeTrue();
    expect(reviewOpen({ checked: ['a'] }, 1)).toBeTrue();
    expect(reviewOpen({ done: true }, 2)).toBeFalse();
    expect(reviewOpen(undefined, 0)).toBeFalse();
  });
});
