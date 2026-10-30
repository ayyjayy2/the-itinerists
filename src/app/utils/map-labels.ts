/**
 * Which name the trip map's labels show (OpenFreeMap / OpenMapTiles data,
 * where each place carries its local `name` plus translations): the app's
 * language by default, or the local name for matching street signs.
 */
export type LabelMode = 'app' | 'local';

/** A MapLibre `text-field` expression for the labels in that mode. */
export function labelExpression(mode: LabelMode, lang: string): unknown[] {
  if (mode === 'local') return ['get', 'name'];
  // The app's language, then the place's English and Latin spellings, then its local name.
  return ['coalesce', ['get', `name:${lang}`], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']];
}

/** The style's layers that label places by name (not house or road numbers). */
export function nameLabelLayers(layers: { id: string; layout?: Record<string, unknown> }[]): string[] {
  return layers
    .filter(l => {
      const field = l.layout?.['text-field'];
      return field !== undefined && /name/.test(JSON.stringify(field));
    })
    .map(l => l.id);
}
