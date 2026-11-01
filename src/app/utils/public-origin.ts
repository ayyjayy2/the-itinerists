/**
 * The address to put in a link someone else will open. In the iPhone app the
 * page's own origin is the app shell (capacitor://localhost), which works for
 * nobody else, so links use the public site of the project the app talks to.
 */
export const PUBLIC_SITES: Record<string, string> = {
  'trip-planner-ayyjayy2': 'https://theitinerists.com',
  'the-itinerists-staging': 'https://the-itinerists-staging.web.app',
};

export function publicOrigin(origin: string, native: boolean, projectId: string): string {
  if (!native && /^https?:\/\//.test(origin)) return origin;
  return PUBLIC_SITES[projectId] ?? PUBLIC_SITES['trip-planner-ayyjayy2'];
}
