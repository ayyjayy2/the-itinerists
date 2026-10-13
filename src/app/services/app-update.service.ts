import { Injectable, inject } from '@angular/core';
import { APP_BUILD } from '../../version';
import { NATIVE_PLATFORM } from '../native-platform';
import { isNewerBuild, isTyping, shouldCheckForUpdate } from '../utils/app-update';

/**
 * Keeps the web app on the live version. Each time the app comes back on
 * screen it reads /version.json (written by scripts/set-version.js at build
 * time, never cached) and, if a newer build is live, refreshes as soon as
 * nobody is typing. The page itself is never cached, so a refresh always
 * loads the newest build. Sign-in is kept in the browser's storage, so a
 * refresh never signs anyone out. The iPhone app carries its own copy of the
 * web app and only changes when a new build is installed, so it's left alone.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private native = inject(NATIVE_PLATFORM);
  private started = false;
  private lastCheckAt: number | null = null;
  /** A newer build is live, waiting for a safe moment to refresh. */
  private waiting = false;

  private readonly onVisibility = () => {
    if (document.visibilityState !== 'visible') return;
    if (this.waiting) { this.reloadWhenSafe(); return; }
    const now = Date.now();
    if (!shouldCheckForUpdate(this.lastCheckAt, now)) return;
    this.lastCheckAt = now;
    this.liveBuild()
      .then(live => {
        if (!isNewerBuild(live, APP_BUILD)) return;
        this.waiting = true;
        this.reloadWhenSafe();
      })
      .catch(err => console.warn('[AppUpdate] check failed:', (err as Error).message));
  };

  start(): void {
    if (this.native || this.started) return;
    this.started = true;
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  stop(): void {
    this.started = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  /** Refresh now if the app is on screen and nobody is typing; otherwise wait for the next return. */
  private reloadWhenSafe(): void {
    if (document.visibilityState !== 'visible' || isTyping(document.activeElement)) return;
    this.waiting = false;
    this.reload();
  }

  private async liveBuild(): Promise<string | undefined> {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return undefined;
    return (await res.json() as { build?: string }).build;
  }

  private reload(): void {
    window.location.reload();
  }
}
