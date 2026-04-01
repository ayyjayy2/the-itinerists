import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Unregister any lingering service workers so users always get fresh content.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
