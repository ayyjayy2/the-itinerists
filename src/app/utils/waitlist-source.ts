/**
 * Where someone on the waitlist came from (#763). The welcome page writes
 * `website`, or `instagram` / `linkedin` when it was opened from a post link
 * (`theitinerists.com/?from=instagram`); `survey` entries are added by the
 * owner with scripts/waitlist.js. Older entries without one count as `website`.
 */
export type WaitlistSource = 'website' | 'instagram' | 'linkedin' | 'survey';

/** The sources the welcome page itself may write (the rules allow only these). */
export type PageSource = 'website' | 'instagram' | 'linkedin';

const KEY = 'waitlist:from';

/** `?from=instagram` (or `ig`) / `?from=linkedin` (or `li`) in a landing address; anything else is no source. */
export function sourceFromSearch(search: string): Exclude<PageSource, 'website'> | null {
  const v = new URLSearchParams(search).get('from')?.trim().toLowerCase();
  if (v === 'instagram' || v === 'ig') return 'instagram';
  if (v === 'linkedin' || v === 'li') return 'linkedin';
  return null;
}

/**
 * Remember the landing address's source for this visit. Called before the app
 * starts, because the redirect to /welcome drops the query string.
 */
export function rememberLandingSource(search: string, storage: Pick<Storage, 'setItem'>): void {
  const source = sourceFromSearch(search);
  if (!source) return;
  try { storage.setItem(KEY, source); } catch { /* private mode: counts as website */ }
}

/** The source to write with a sign-up on this visit. */
export function landingSource(storage: Pick<Storage, 'getItem'>): PageSource {
  try {
    const v = storage.getItem(KEY);
    return v === 'instagram' || v === 'linkedin' ? v : 'website';
  } catch {
    return 'website';
  }
}
