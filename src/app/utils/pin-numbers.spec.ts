import { numberPins } from './pin-numbers';

describe('numberPins', () => {
  const onMap = (missing: string[] = []) => (loc: string) => !missing.includes(loc);

  it('numbers a day\'s places 1, 2, 3 in the day\'s order', () => {
    const nums = numberPins([
      { loc: 'Lunch',   sortOrder: 2, time: '12:30 PM' },
      { loc: 'Temples', sortOrder: 1, time: '9:00 AM' },
      { loc: 'Bazaar',  sortOrder: 3, time: '7:00 PM' },
    ], onMap());
    expect([...nums]).toEqual([['Temples', 1], ['Lunch', 2], ['Bazaar', 3]]);
  });

  it('skips places that aren\'t on the map, so the first pin is always 1', () => {
    const nums = numberPins([
      { loc: 'Temples', sortOrder: 1 }, { loc: 'Lunch', sortOrder: 2 }, { loc: 'Bazaar', sortOrder: 3 },
    ], onMap(['Temples']));
    expect([...nums]).toEqual([['Lunch', 1], ['Bazaar', 2]]);
  });

  it('orders by time when there\'s no set order, and gives a repeated place one number', () => {
    const nums = numberPins([
      { loc: 'Hotel', time: '7:00 PM' }, { loc: 'Cafe', time: '8:00 AM' }, { loc: 'Hotel', time: '9:00 AM' }, { loc: null },
    ], onMap());
    expect([...nums]).toEqual([['Cafe', 1], ['Hotel', 2]]);
  });
});
