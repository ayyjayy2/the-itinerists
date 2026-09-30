import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import { provideFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { provideAuth, getAuth, initializeAuth, indexedDBLocalPersistence } from '@angular/fire/auth';
import { Capacitor } from '@capacitor/core';
import { provideAppCheck, initializeAppCheck, ReCaptchaV3Provider, getToken } from '@angular/fire/app-check';
import { provideAnalytics, getAnalytics, ScreenTrackingService, UserTrackingService } from '@angular/fire/analytics';
import { DEMO } from './demo-flag';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { AppErrorHandler } from './services/error-logger.service';

/** True inside the Capacitor shell (iOS/Android app), false in a browser. */
const NATIVE = Capacitor.isNativePlatform();

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Every page chunk downloads in the background right after boot, so the
    // first navigation after sign-in never waits on the network.
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => initializeFirestore(getApp(), {
      // Durable offline cache (IndexedDB): offline writes are queued to disk and
      // survive reloads/crashes, then auto-sync on reconnect. Cold-start offline
      // still shows last-synced data. Multi-tab manager keeps tabs consistent.
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })),
    provideStorage(() => getStorage()),
    // In the native shell, getAuth()'s default set-up waits on a redirect-result
    // iframe that never answers inside WKWebView, so sign-in state never
    // resolves. Initialising with persistence only skips that (Capacitor's
    // documented approach). Browsers keep the default.
    provideAuth(() => NATIVE
      ? initializeAuth(getApp(), { persistence: indexedDBLocalPersistence })
      : getAuth()),

    // App Check (optional): activates only when RECAPTCHA_SITE_KEY is set in .env.
    // Attests that requests come from the genuine app, blocking key abuse. Until a
    // site key is configured this contributes no providers — a safe no-op.
    ...(environment.recaptchaSiteKey
      ? [provideAppCheck(() => {
          if (isDevMode() || NATIVE) {
            // NATIVE: reCAPTCHA can't attest a WKWebView either. Until the app
            // uses App Attest through a Capacitor App Check plugin, the shell
            // runs on a debug token (printed to the console on first launch;
            // register it in Firebase → App Check → Manage debug tokens).
            // Local dev can't pass reCAPTCHA attestation (localhost isn't an
            // allowed domain), so use a debug token instead. APPCHECK_DEBUG_TOKEN
            // in .env pins a token already registered in Firebase console, valid
            // on any browser/machine. Without it, the SDK generates a random
            // token and prints it to the browser console — register that one in
            // Firebase console → App Check → Apps → Manage debug tokens.
            (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
              environment.appCheckDebugToken || true;
          }
          const appCheck = initializeAppCheck(getApp(), {
            provider: new ReCaptchaV3Provider(environment.recaptchaSiteKey),
            isTokenAutoRefreshEnabled: true,
          });
          // Fetch the token now, while the sign-in screen is up, instead of on
          // the first Firestore request — one fewer round trip at sign-in.
          void getToken(appCheck).catch(() => {/* the first request will retry */});
          return appCheck;
        })]
      : []),

    // Google Analytics 4 (free): every route becomes a screen view, users are
    // counted across sessions, and AnalyticsService adds platform / time zone /
    // trip. Web only: gtag can't run inside the Capacitor shell (a native
    // plugin will cover that later) and the demo reports nothing. Without a
    // measurementId in .env this contributes no providers — a safe no-op.
    ...(environment.firebase.measurementId && !NATIVE && !DEMO
      ? [provideAnalytics(() => getAnalytics()), ScreenTrackingService, UserTrackingService]
      : []),
    { provide: ErrorHandler, useClass: AppErrorHandler },

    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
