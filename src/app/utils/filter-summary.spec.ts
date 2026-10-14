import { filterSummary } from './filter-summary';

describe('filterSummary (#482)', () => {
  it('reads "All" when nothing is ticked', () => {
    expect(filterSummary([])).toBe('All');
  });

  it('names one or two choices', () => {
    expect(filterSummary(['Food'])).toBe('Food');
    expect(filterSummary(['Food', 'Drink'])).toBe('Food, Drink');
  });

  it('names the first and counts the rest from three on', () => {
    expect(filterSummary(['Food', 'Drink', 'Tips'])).toBe('Food + 2');
  });
});
