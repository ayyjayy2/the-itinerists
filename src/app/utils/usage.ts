/**
 * Helpers for the usage event log (`_activity`), kept pure so they can be
 * unit-tested without Angular or Firebase.
 */

export type UsagePlatform = 'web' | 'pwa' | 'ios';

/**
 * The page part of a router URL, with nothing that could identify a person or
 * a trip: no query string (invite codes travel there), no fragment, no
 * trailing slash. The app has no parameterised routes, so the path is the page.
 */
export function usagePage(url: string): string {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '');
  return path === '' ? '/' : path;
}

/** Where the app is running: the native shell, an installed web app, or a browser tab. */
export function usagePlatform(native: boolean, standalone: boolean): UsagePlatform {
  if (native) return 'ios';
  return standalone ? 'pwa' : 'web';
}

/** The user's own clock at `date`: hour of day, IANA zone, and offset from UTC in minutes. */
export function localClock(date: Date, tz: string | undefined): { localHour: number; tz: string; tzOffsetMin: number } {
  return {
    localHour: date.getHours(),
    tz: tz || 'UTC',
    tzOffsetMin: -date.getTimezoneOffset(),
  };
}

/**
 * The session start and the first route change both want to record the page
 * the app opened on; a reload does the same. One view within two seconds of
 * the same page is the same view.
 */
export function isRepeatPageView(prev: { page: string; at: number } | null, page: string, now: number): boolean {
  return prev !== null && prev.page === page && now - prev.at < 2000;
}
