import { groupRecsByCategory, groupRecsByDestination, withAnywhereCategory, withCategory, ANYWHERE } from './rec-groups';

interface R { id: string; category: string; destination?: string }
const rec = (id: string, category: string, destination?: string): R => ({ id, category, destination });

describe('groupRecsByCategory', () => {
  it('orders known categories by the given order, then custom ones alphabetically', () => {
    const groups = groupRecsByCategory(
      [rec('a', 'Tips'), rec('b', 'Food'), rec('c', 'Zoo'), rec('d', 'Market'), rec('e', 'Food')],
      ['Food', 'Drink', 'Tips'],
    );
    expect(groups.map(g => g.category)).toEqual(['Food', 'Tips', 'Market', 'Zoo']);
    expect(groups[0].recs.map(r => r.id)).toEqual(['b', 'e']);
  });
});

describe('groupRecsByDestination', () => {
  const legs = ['Chiang Mai, Thailand', 'Bangkok, Thailand'];

  it('sections recs by destination in leg order, categories inside each', () => {
    const sections = groupRecsByDestination(
      [rec('a', 'Food', 'Bangkok, Thailand'), rec('b', 'Tips', 'Chiang Mai, Thailand'), rec('c', 'Food', 'Chiang Mai, Thailand')],
      legs, ['Food', 'Tips'],
    );
    expect(sections.map(s => s.destination)).toEqual(['Chiang Mai, Thailand', 'Bangkok, Thailand']);
    expect(sections[0].groups.map(g => g.category)).toEqual(['Food', 'Tips']);
    expect(sections[1].groups[0].recs.map(r => r.id)).toEqual(['a']);
  });

  it('puts recs with no destination, or an unknown one, in an Anywhere section last', () => {
    const sections = groupRecsByDestination(
      [rec('a', 'Tips'), rec('b', 'Food', 'Bangkok, Thailand'), rec('c', 'Tips', 'Phuket')],
      legs, ['Food', 'Tips'],
    );
    expect(sections.map(s => s.destination)).toEqual(['Bangkok, Thailand', ANYWHERE]);
    expect(sections[1].groups[0].recs.map(r => r.id)).toEqual(['a', 'c']);
  });

  it('omits legs that have no recs', () => {
    const sections = groupRecsByDestination([rec('a', 'Food', 'Bangkok, Thailand')], legs, ['Food']);
    expect(sections.map(s => s.destination)).toEqual(['Bangkok, Thailand']);
  });

  it('matches destinations case- and whitespace-insensitively', () => {
    const sections = groupRecsByDestination([rec('a', 'Food', ' bangkok, thailand ')], legs, ['Food']);
    expect(sections[0].destination).toBe('Bangkok, Thailand');
  });
});

describe('withCategory', () => {
  const order = ['Food', 'Drink', 'Tips', 'Culture'];
  it('adds an empty group in its place when the category is missing', () => {
    const groups = groupRecsByCategory([rec('a', 'Food'), rec('b', 'Culture')], order);
    expect(withCategory(groups, 'Tips', order).map(g => [g.category, g.recs.length])).toEqual([['Food', 1], ['Tips', 0], ['Culture', 1]]);
  });
  it('leaves the groups alone when the category is there', () => {
    const groups = groupRecsByCategory([rec('a', 'Tips')], order);
    expect(withCategory(groups, 'Tips', order)).toEqual(groups);
  });
  it('works on an empty list', () => {
    expect(withCategory<R>([], 'Tips', order)).toEqual([{ category: 'Tips', recs: [] }]);
  });
});

describe('withAnywhereCategory', () => {
  const order = ['Food', 'Tips'];
  const legs = ['Berlin, Germany'];
  it('adds the category to the Anywhere section', () => {
    const sections = groupRecsByDestination([rec('a', 'Food'), rec('b', 'Food', 'Berlin, Germany')], legs, order);
    const out = withAnywhereCategory(sections, 'Tips', order);
    expect(out.map(s => s.destination)).toEqual(['Berlin, Germany', ANYWHERE]);
    expect(out[1].groups.map(g => g.category)).toEqual(['Food', 'Tips']);
  });
  it('adds an Anywhere section last when there is none', () => {
    const sections = groupRecsByDestination([rec('b', 'Food', 'Berlin, Germany')], legs, order);
    const out = withAnywhereCategory(sections, 'Tips', order);
    expect(out.map(s => s.destination)).toEqual(['Berlin, Germany', ANYWHERE]);
    expect(out[1].groups).toEqual([{ category: 'Tips', recs: [] }]);
  });
});
