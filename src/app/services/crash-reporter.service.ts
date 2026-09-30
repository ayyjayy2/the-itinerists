import { Injectable, InjectionToken, inject } from '@angular/core';

/** The slice of @capacitor-firebase/crashlytics this app uses (kept narrow so tests can fake it). */
export interface CrashlyticsLike {
  recordException(o: { message: string; stacktrace?: { lineNumber?: number; fileName?: string; functionName?: string }[] }): Promise<void>;
  setUserId(o: { userId: string }): Promise<void>;
  log(o: { message: string }): Promise<void>;
  setEnabled(o: { enabled: boolean }): Promise<void>;
}

export const CRASH_REPORTER_PLUGIN = new InjectionToken<CrashlyticsLike>('CRASH_REPORTER_PLUGIN');
export const CRASH_REPORTER_NATIVE = new InjectionToken<boolean>('CRASH_REPORTER_NATIVE');

/**
 * Crashlytics for the native shell. On the web it is inert: the Firestore
 * `_appLogs` collection stays the error log there. On iOS/Android every error
 * that reaches ErrorLoggerService is also recorded here (non-fatal), and native
 * crashes are captured by the SDK itself. Reports carry the uid only, never an
 * email or name.
 */
@Injectable({ providedIn: 'root' })
export class CrashReporterService {
  private plugin = inject(CRASH_REPORTER_PLUGIN, { optional: true });
  readonly active = !!inject(CRASH_REPORTER_NATIVE, { optional: true }) && !!this.plugin;

  async record(error: unknown, type: string): Promise<void> {
    if (!this.active) return;
    const err = error instanceof Error ? error : new Error(String(error));
    try {
      await this.plugin!.recordException({
        message: `${type}: ${err.message}`,
        stacktrace: parseStack(err.stack),
      });
    } catch { /* never let the reporter itself become an error */ }
  }

  async setUser(uid: string | null): Promise<void> {
    if (!this.active) return;
    try { await this.plugin!.setUserId({ userId: uid ?? '' }); } catch { /* ignore */ }
  }
}

/** Turn a JS stack string into Crashlytics frames (best effort; keeps the raw line as the function name). */
function parseStack(stack: string | undefined): { lineNumber?: number; fileName?: string; functionName?: string }[] {
  if (!stack) return [{ functionName: '(no stack)' }];
  return stack.split('\n').slice(0, 20).map(line => {
    const m = /(?:at\s+)?(.*?)\s*\(?([^()\s]+):(\d+):\d+\)?$/.exec(line.trim());
    return m ? { functionName: m[1] || '(anonymous)', fileName: m[2], lineNumber: Number(m[3]) }
             : { functionName: line.trim() };
  });
}
