/**
 * Demo entry point (`ng build --configuration demo`).
 *
 * Starts every page load from a clean slate: local storage left by a previous
 * visit is cleared, the in-memory store is seeded with the mock trip, and the
 * app boots signed in as the demo traveller. Nothing a visitor does survives
 * the tab.
 */
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { demoStore } from './demo/fire-firestore';
import { seedDemo } from './demo/seed';

const STORAGE_PREFIXES = ['tripplanner_', 'tripmap_'];

function clearPreviousSession(): void {
  try {
    const stale = Object.keys(localStorage).filter(k => STORAGE_PREFIXES.some(p => k.startsWith(p)));
    stale.forEach(k => localStorage.removeItem(k));
  } catch { /* storage unavailable — nothing to clear */ }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}

clearPreviousSession();
seedDemo(demoStore);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
