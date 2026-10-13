import { leftOutOfSplit, splitPatch } from './split-gaps';

const SIX = ['Maya', 'Theo', 'Jo', 'Rafa', 'Sam', 'Ana'];

describe('leftOutOfSplit (#447)', () => {
  it('names current members an "Everyone" split with individual amounts has no amount for (they joined later)', () => {
    const entry = { splitAmong: 'All', splits: { Maya: 170.74, Theo: 56.92, Jo: 56.92, Rafa: 56.92 } };
    expect(leftOutOfSplit(entry, SIX)).toEqual(['Sam', 'Ana']);
  });

  it("doesn't flag an amount deliberately set to 0", () => {
    const entry = { splitAmong: 'All', splits: { Maya: 100, Theo: 0, Jo: 0, Rafa: 0, Sam: 0, Ana: 0 } };
    expect(leftOutOfSplit(entry, SIX)).toEqual([]);
  });

  it("doesn't flag equal splits: those include later joiners automatically", () => {
    expect(leftOutOfSplit({ splitAmong: 'All' }, SIX)).toEqual([]);
    expect(leftOutOfSplit({ splitAmong: 'All', splits: null }, SIX)).toEqual([]);
    expect(leftOutOfSplit({ splitAmong: 'All', splits: {} }, SIX)).toEqual([]);
  });

  it("doesn't flag a split among chosen people: leaving someone out was the point", () => {
    expect(leftOutOfSplit({ splitAmong: 'Maya, Theo', splits: { Maya: 10, Theo: 20 } }, SIX)).toEqual([]);
  });
});

describe('splitPatch', () => {
  it('an equal split clears any old individual amounts (null, so the save really removes them)', () => {
    expect(splitPatch('equal', SIX, {}, SIX)).toEqual({ splitAmong: 'All', splits: null });
    expect(splitPatch('equal', ['Maya', 'Theo'], { Maya: 5 }, SIX)).toEqual({ splitAmong: 'Maya, Theo', splits: null });
  });

  it('an individual split keeps one amount per chosen person', () => {
    expect(splitPatch('individual', ['Maya', 'Theo'], { Maya: '12.5' as unknown as number, Theo: 7.5, Jo: 99 }, SIX))
      .toEqual({ splitAmong: 'Maya, Theo', splits: { Maya: 12.5, Theo: 7.5 } });
  });

  it('everyone chosen is stored as "All"', () => {
    expect(splitPatch('individual', SIX, Object.fromEntries(SIX.map(n => [n, 1])), SIX).splitAmong).toBe('All');
  });
});
