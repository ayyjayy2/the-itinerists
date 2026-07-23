import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import { provideFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideAppCheck, initializeAppCheck, ReCaptchaV3Provider } from '@angular/fire/app-check';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { AppErrorHandler } from './services/error-logger.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => initializeFirestore(getApp(), {
      // Durable offline cache (IndexedDB): offline writes are queued to disk and
      // survive reloads/crashes, then auto-sync on reconnect. Cold-start offline
      // still shows last-synced data. Multi-tab manager keeps tabs consistent.
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })),
    provideStorage(() => getStorage()),
    provideAuth(() => getAuth()),

    // App Check (optional): activates only when RECAPTCHA_SITE_KEY is set in .env.
    // Attests that requests come from the genuine app, blocking key abuse. Until a
    // site key is configured this contributes no providers — a safe no-op.
    ...(environment.recaptchaSiteKey
      ? [provideAppCheck(() => initializeAppCheck(getApp(), {
          provider: new ReCaptchaV3Provider(environment.recaptchaSiteKey),
          isTokenAutoRefreshEnabled: true,
        }))]
      : []),

    { provide: ErrorHandler, useClass: AppErrorHandler },

    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
