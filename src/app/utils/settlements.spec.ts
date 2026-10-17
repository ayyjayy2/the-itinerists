import { filterSettlements, netLine, workingText, personTotals, unpaidBetween, DirectDebt, SettlementFilter } from './settlements';

const item = (id: string, amount: number) =>
  ({ id, label: id, date: '2026-10-01', amount, origAmount: amount, origCurrency: 'USD', estimated: false });

/** Maya owes Alayna for two expenses. */
const mayaOwesAlayna: DirectDebt = { from: 'Maya', to: 'Alayna', amountHome: 30, items: [item('dinner', 10), item('taxi', 20)] };

function run(status: 'owed' | 'paid', paidIds: string[], over: Partial<SettlementFilter> = {}) {
  const paid = new Set(paidIds);
  return filterSettlements([mayaOwesAlayna], {
    me: 'Alayna', status, scope: 'all', selectedUsers: null, query: '',
    isPaid: (_f, _t, id) => paid.has(id), ...over,
  });
}

describe('filterSettlements: one of two items marked paid', () => {
  it('Owed still lists the pair with only the unpaid item', () => {
    const r = run('owed', ['dinner']);
    expect(r.length).toBe(1);
    expect(r[0].items.map(i => i.id)).toEqual(['taxi']);
    expect(r[0].amountHome).toBe(20);
  });

  it('Paid lists the pair with only the paid item (the bug: it showed nothing)', () => {
    const r = run('paid', ['dinner']);
    expect(r.length).toBe(1);
    expect(r[0].items.map(i => i.id)).toEqual(['dinner']);
    expect(r[0].amountHome).toBe(10);
  });
});

describe('filterSettlements: all or nothing paid', () => {
  it('nothing paid → Owed shows both, Paid shows nothing', () => {
    expect(run('owed', [])[0].items.length).toBe(2);
    expect(run('paid', []).length).toBe(0);
  });
  it('everything paid → Owed shows nothing, Paid shows both', () => {
    expect(run('owed', ['dinner', 'taxi']).length).toBe(0);
    expect(run('paid', ['dinner', 'taxi'])[0].items.length).toBe(2);
  });
});

describe('filterSettlements: scope, people and search', () => {
  it('"My Trip" scope hides pairs I am not part of', () => {
    expect(run('owed', [], { me: 'Sam', scope: 'mine' }).length).toBe(0);
    expect(run('owed', [], { me: 'Maya', scope: 'mine' }).length).toBe(1);
  });
  it('people filter keeps a pair when either side is selected', () => {
    expect(run('owed', [], { selectedUsers: new Set(['Maya']) }).length).toBe(1);
    expect(run('owed', [], { selectedUsers: new Set(['Sam']) }).length).toBe(0);
  });
  it('search narrows to matching items, or keeps all items on a name match', () => {
    expect(run('owed', [], { query: 'taxi' })[0].items.map(i => i.id)).toEqual(['taxi']);
    expect(run('owed', [], { query: 'maya' })[0].items.length).toBe(2);
    expect(run('owed', [], { query: 'zzz' }).length).toBe(0);
  });
});

describe('the working behind a netted balance (#519)', () => {
  // Maya owes Alayna 4,940 across three expenses (one more is paid); Alayna owes Maya 308.
  const debts: DirectDebt[] = [
    { from: 'Maya', to: 'Alayna', amountHome: 6140, items: [item('rooftop', 240), item('airport', 2700), item('elephants', 2000), item('baan', 1200)] },
    { from: 'Alayna', to: 'Maya', amountHome: 308, items: [item('blues', 180), item('khao-soi', 128)] },
    { from: 'Jo', to: 'Maya', amountHome: 50, items: [item('taxi', 50)] },
  ];
  const isPaid = (_f: string, _t: string, id: string) => id === 'baan';

  it('adds up what one person still owes another, leaving out paid items', () => {
    expect(unpaidBetween(debts, 'Maya', 'Alayna', isPaid)).toBe(4940);
    expect(unpaidBetween(debts, 'Alayna', 'Maya', isPaid)).toBe(308);
    expect(unpaidBetween(debts, 'Theo', 'Maya', isPaid)).toBe(0);
  });

  it('totals what a person is owed and owes across everyone', () => {
    expect(personTotals(debts, 'Maya', isPaid)).toEqual({ owed: 308 + 50, owes: 4940 });
    expect(personTotals(debts, 'Alayna', isPaid)).toEqual({ owed: 4940, owes: 308 });
    expect(personTotals(debts, 'Theo', isPaid)).toEqual({ owed: 0, owes: 0 });
  });

  it('nets the two sides and keeps the working: 4,940 − 308 = 4,632', () => {
    expect(netLine('Maya', 4940, 308)).toEqual({ name: 'Maya', direction: 'owed', amountHome: 4632, gross: 4940, less: 308 });
    expect(netLine('Maya', 308, 4940)).toEqual({ name: 'Maya', direction: 'owes', amountHome: 4632, gross: 4940, less: 308 });
  });

  it('has nothing to take off when only one side owes', () => {
    expect(netLine('Jo', 0, 50)).toEqual({ name: 'Jo', direction: 'owes', amountHome: 50, gross: 50, less: 0 });
  });

  it('is settled when both sides cancel out', () => {
    expect(netLine('Theo', 120, 120).direction).toBe('settled');
  });

  it('writes the working as a subtraction, larger side first, from each point of view', () => {
    const owed = netLine('Maya', 4940, 308), owes = netLine('Maya', 308, 4940);
    expect(workingText(owed, 'me')).toBe('owes you 4,940 − 308 you owe');
    expect(workingText(owes, 'me')).toBe('you owe 4,940 − 308 owes you');
    expect(workingText(owed, 'person')).toBe('is owed 4,940 − 308 owes');
    expect(workingText(owes, 'person')).toBe('owes 4,940 − 308 is owed');
    expect(workingText(owed, 'pair')).toBe('owes them 4,940 − 308 they owe');
    expect(workingText(owes, 'pair')).toBe('they owe 4,940 − 308 owes them');
  });

  it('keeps cents only when there are some, and says nothing when one side owes', () => {
    expect(workingText(netLine('Theo', 4000, 887.5), 'me')).toBe('owes you 4,000 − 887.50 you owe');
    expect(workingText(netLine('Jo', 50, 0), 'me')).toBe('');
  });
});
