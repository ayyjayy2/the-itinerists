import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { rememberLandingSource } from './app/utils/waitlist-source';

// Unregister any lingering service workers so users always get fresh content.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}

// Where a visitor came from (?from=instagram), kept for the waitlist before the
// redirect to /welcome drops the query string (#763).
try { rememberLandingSource(location.search, sessionStorage); } catch { /* storage blocked */ }

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
