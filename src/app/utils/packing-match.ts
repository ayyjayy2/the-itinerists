/**
 * Feeding outfit items onto the packing list without creating exact duplicates.
 * Matching is deliberately simple: same text, ignoring case and surrounding
 * whitespace. Anything fuzzier ("sneakers" vs "White sneakers") is left to the
 * person, who can see both and decide.
 */

/** Comparison key: trimmed, lower-cased. */
export function packingKey(label: string): string {
  return label.trim().toLowerCase();
}

/** True when two labels are the same text, ignoring case and surrounding whitespace. */
export function isSamePackingItem(a: string, b: string): boolean {
  const ka = packingKey(a);
  return !!ka && ka === packingKey(b);
}

const CATEGORY_WORDS: Array<[category: string, pattern: RegExp]> = [
  ['Shoes',       /\b(shoe|sneaker|trainer|boot|sandal|heel|loafer|flat|flip ?flop|slipper|slide|espadrille|clog)s?\b/i],
  ['Outerwear',   /\b(jacket|coat|raincoat|windbreaker|parka|hoodie|sweater|jumper|cardigan|fleece|blazer|poncho|shell|vest|anorak|puffer)s?\b/i],
  ['Accessories', /\b(hat|cap|beanie|sunglasses|glasses|scarf|scarves|belt|bag|purse|tote|backpack|watch|jewel|jewelry|earring|necklace|bracelet|ring|glove|mitten|umbrella|wallet|headband|tie)s?\b/i],
];

/** Best-guess packing category for a clothing item; defaults to Clothes. */
export function guessPackingCategory(label: string): string {
  for (const [category, pattern] of CATEGORY_WORDS) {
    if (pattern.test(label)) return category;
  }
  return 'Clothes';
}

export interface PackingSync {
  /** Items put on the packing list. */
  added:   string[];
  /** Items left off because the list already has them. */
  skipped: string[];
}

/**
 * Which outfit items should go onto the packing list after a save: only items
 * that are new to this outfit (so removing something from the packing list is
 * not undone by the next outfit edit), de-duplicated, and not already on the
 * list as the exact same text.
 */
export function newItemsForPacking(
  outfitItems: readonly string[],
  previousOutfitItems: readonly string[],
  packingLabels: readonly string[],
): PackingSync {
  const result: PackingSync = { added: [], skipped: [] };
  const seen = new Set<string>();
  for (const raw of outfitItems) {
    const item = raw.trim();
    const key  = packingKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (previousOutfitItems.some(p => isSamePackingItem(p, item))) continue;
    if (packingLabels.some(p => isSamePackingItem(p, item))) result.skipped.push(item);
    else result.added.push(item);
  }
  return result;
}
