import { filterSettlements, DirectDebt, SettlementFilter } from './settlements';

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
