/**
 * Every page someone can open while signed in, with the name the app's menu
 * uses. Pulse's "Page visits" chart lists all of them, 0 included, so unused
 * pages show up. test/pulse-stats.test.mjs checks this against
 * src/app/app.routes.ts: add a new route here too.
 */
export const APP_PAGES = [
  { path: '/home',           label: 'Home' },
  { path: '/itinerary',      label: 'Itinerary' },
  { path: '/finance',        label: 'Finance' },
  { path: '/packing',        label: 'Packing' },
  { path: '/flights',        label: 'Flights' },
  { path: '/accommodations', label: 'Stays' },
  { path: '/map',            label: 'Map' },
  { path: '/transportation', label: 'Transportation' },
  { path: '/expenses',       label: 'My Expenses' },
  { path: '/recs',           label: 'Recs' },
  { path: '/outfits',        label: 'Outfits' },
  { path: '/updates',        label: 'Updates' },
  { path: '/trips',          label: 'My Trips' },
  { path: '/trips/new',      label: 'New trip' },
  { path: '/trip-settings',  label: 'Trip Settings' },
  { path: '/profile',        label: 'Profile' },
  { path: '/admin',          label: 'Admin' },
  { path: '/get-started',    label: 'Get started' },
  { path: '/join',           label: 'Join a trip' },
  { path: '/privacy',        label: 'Privacy policy' },
  { path: '/terms',          label: 'Terms' },
  { path: '/view',           label: 'Shared trip page' },
];

/** Seen only while signed out, when no visits are recorded: listing them would always read 0. */
export const SIGNED_OUT_PAGES = ['/welcome', '/login', '/signup', '/forgot-password'];
