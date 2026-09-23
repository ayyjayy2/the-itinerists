import { packingKey, isSamePackingItem, guessPackingCategory, newItemsForPacking } from './packing-match';

describe('packingKey', () => {
  it('ignores case and surrounding whitespace only', () => {
    expect(packingKey('  Rain Jacket ')).toBe('rain jacket');
    expect(packingKey('Sneakers')).not.toBe(packingKey('sneaker'));
  });
});

describe('isSamePackingItem', () => {
  it('matches the same text in different case or with stray spaces', () => {
    expect(isSamePackingItem('rain jacket', 'Rain Jacket')).toBeTrue();
    expect(isSamePackingItem(' Sandals', 'sandals ')).toBeTrue();
  });

  it('does not match plurals, variants, or more specific names', () => {
    expect(isSamePackingItem('Sneakers', 'sneaker')).toBeFalse();
    expect(isSamePackingItem('White sneakers', 'sneakers')).toBeFalse();
    expect(isSamePackingItem('dress', 'sundress')).toBeFalse();
  });
});

describe('guessPackingCategory', () => {
  it('sorts common items into the default packing categories', () => {
    expect(guessPackingCategory('White sneakers')).toBe('Shoes');
    expect(guessPackingCategory('Rain jacket')).toBe('Outerwear');
    expect(guessPackingCategory('Sunglasses')).toBe('Accessories');
    expect(guessPackingCategory('Flowy sundress')).toBe('Clothes');
  });
});

describe('newItemsForPacking', () => {
  it('adds outfit items that are new to the outfit and not already on the list', () => {
    const result = newItemsForPacking(
      ['Flowy sundress', 'rain jacket', 'Sun hat', 'Sandals'],  // outfit after save
      ['Sandals'],                                            // outfit before save
      ['Rain jacket', 'Sunscreen'],                            // packing list
    );
    expect(result.added).toEqual(['Flowy sundress', 'Sun hat']);
    expect(result.skipped).toEqual(['rain jacket']);
  });

  it('adds a near-duplicate rather than guessing it is the same thing', () => {
    const result = newItemsForPacking(['Sneakers'], [], ['White sneakers']);
    expect(result.added).toEqual(['Sneakers']);
    expect(result.skipped).toEqual([]);
  });

  it('ignores blanks and does not add the same new item twice', () => {
    const result = newItemsForPacking(['Scarf', ' scarf ', ''], [], []);
    expect(result.added).toEqual(['Scarf']);
  });
});
