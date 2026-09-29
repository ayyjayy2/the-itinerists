import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the production web build in a native shell (ROADMAP Phase 4).
 * The bundle id can still change until the app is registered in App Store
 * Connect; after that it is permanent.
 */
const config: CapacitorConfig = {
  appId: 'com.theitinerists.app',
  appName: 'The Itinerists',
  webDir: 'dist/the-itinerists/browser',
  ios: {
    // 'never': the web view fills the whole screen and the app's own CSS
    // (env(safe-area-inset-*) on the header and tab bar) handles the notch and
    // home indicator. 'automatic' insets the view as well, so both applied and
    // left a band at the top and a gap under the tab bar.
    contentInset: 'never',
    // Keeps the web view's background in step with the app's cream ground
    // while a page is loading, so there is no white flash.
    backgroundColor: '#F8F4EF',
  },
  plugins: {
    // The branded launch screen (Splash imageset) stays up until the app has
    // resolved sign-in state and hides it itself (AppComponent), so there is
    // no cream flash and no spinner before the first real screen.
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#F8F4EF',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
  server: {
    // Angular's router handles every path; without this a reload on /profile
    // would 404 inside the shell.
    androidScheme: 'https',
  },
};

export default config;
