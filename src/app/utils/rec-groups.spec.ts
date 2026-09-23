import { groupRecsByCategory, groupRecsByDestination, ANYWHERE } from './rec-groups';

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
