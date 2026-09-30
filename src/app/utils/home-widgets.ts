import { applyNavOrder } from './nav-order';

/**
 * Home "At a glance" widgets — one per optional page (Map has none: the
 * day-map card covers it). Pure helpers so the Home component stays thin
 * and everything here is unit-testable without Angular.
 */
export type WidgetKey =
  | 'itinerary' | 'finance' | 'packing' | 'flights' | 'accommodations'
  | 'transportation' | 'expenses' | 'recs' | 'outfits';

/** Default order = the shell's base nav order (app.component.ts). */
export const WIDGET_PATHS: Record<WidgetKey, string> = {
  itinerary:      '/itinerary',
  finance:        '/finance',
  packing:        '/packing',
  flights:        '/flights',
  accommodations: '/accommodations',
  transportation: '/transportation',
  expenses:       '/expenses',
  recs:           '/recs',
  outfits:        '/outfits',
};

/** Hidden-page keys are route paths without the slash (members/{uid}.hiddenPages). */
export function isPageHidden(path: string, hidden: readonly string[]): boolean {
  return hidden.includes(path.replace(/^\//, ''));
}

/**
 * Widgets to render, in the user's personal nav order, minus hidden pages.
 * Itinerary always leads because it is the one page that can't be hidden.
 */
export function visibleWidgetKeys(
  navOrder: readonly string[] | undefined, hidden: readonly string[],
): WidgetKey[] {
  const all = (Object.keys(WIDGET_PATHS) as WidgetKey[]).map(key => ({ key, path: WIDGET_PATHS[key] }));
  const ordered = applyNavOrder(all, navOrder).filter(w => !isPageHidden(w.path, hidden));
  const itin = ordered.filter(w => w.key === 'itinerary');
  const rest = ordered.filter(w => w.key !== 'itinerary');
  return [...itin, ...rest].map(w => w.key);
}
