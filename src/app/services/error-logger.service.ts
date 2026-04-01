import { Injectable, ErrorHandler, inject } from '@angular/core';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

type LogType = 'js_error' | 'http_error' | 'firebase_error' | 'write_spike';

interface AppLog {
  timestamp: string;   // ISO 8601 UTC
  type: LogType;
  message: string;
  stack?: string;      // first 500 chars — enough to identify origin, not a privacy risk
  url: string;         // window.location.pathname at time of event
  sessionId: string;   // random UUID per browser session, not tied to any user identity
}

/**
 * Writes structured logs to the Firestore `_appLogs` collection.
 *
 * Two concerns handled here:
 *   1. Error logging  — JS exceptions, Firebase errors, HTTP failures
 *   2. Write spike detection — flags sessions that generate an unusual number of
 *      Firestore writes in a short window (potential abuse or a bug causing loops)
 *
 * Logs are write-only from the client (see firestore.rules). Read them via the
 * Firebase Console or Admin SDK.
 */
@Injectable({ providedIn: 'root' })
export class ErrorLoggerService {
  private firestore = inject(Firestore);

  // Stable per-session identifier so related events can be correlated in the logs.
  // Not linked to any user account — just a random UUID for this browser tab's lifetime.
  readonly sessionId = crypto.randomUUID();

  // Rolling window of write timestamps for spike detection.
  private writeTimestamps: number[] = [];

  // Threshold: more than this many Firestore writes in 60 seconds flags as suspicious.
  // Set at 45 to comfortably accommodate rapid editing sessions from laptop/phone.
  private readonly SPIKE_THRESHOLD = 45;

  /**
   * Call this from every service-layer Firestore write so the rate can be tracked.
   * Logs a write_spike event if the rolling-minute count exceeds the threshold.
   */
  trackWrite(): void {
    const now = Date.now();
    // Keep only timestamps from the last 60 seconds
    this.writeTimestamps = this.writeTimestamps.filter(t => now - t < 60_000);
    this.writeTimestamps.push(now);

    if (this.writeTimestamps.length > this.SPIKE_THRESHOLD) {
      this.writeLog({
        type: 'write_spike',
        message: `${this.writeTimestamps.length} writes in the last 60s (threshold: ${this.SPIKE_THRESHOLD})`,
      });
    }
  }

  /** Log an error with automatic type classification. */
  logError(error: unknown, type: LogType = 'js_error'): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this.writeLog({
      type,
      message: err.message,
      stack: err.stack?.slice(0, 500),
    });
  }

  private writeLog(partial: Omit<AppLog, 'timestamp' | 'url' | 'sessionId'>): void {
    const log: AppLog = {
      ...partial,
      timestamp: new Date().toISOString(),
      url: window.location.pathname,
      sessionId: this.sessionId,
    };
    addDoc(collection(this.firestore, '_appLogs'), log).catch(() => {
      // Intentionally silent — never throw from the logger itself to avoid infinite loops.
    });
  }
}

/**
 * Overrides Angular's default ErrorHandler to route uncaught exceptions and
 * unhandled promise rejections through ErrorLoggerService.
 *
 * Registered in app.config.ts via: { provide: ErrorHandler, useClass: AppErrorHandler }
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private logger = inject(ErrorLoggerService);

  handleError(error: unknown): void {
    this.logger.logError(error, this.classify(error));
    // Keep console output so devtools still show the error during development.
    console.error(error);
  }

  private classify(error: unknown): LogType {
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
    if (msg.includes('http') || msg.includes('status code') || msg.includes('httperror')) {
      return 'http_error';
    }
    if (msg.includes('firebase') || msg.includes('firestore') || msg.includes('firebaseError')) {
      return 'firebase_error';
    }
    return 'js_error';
  }
}
