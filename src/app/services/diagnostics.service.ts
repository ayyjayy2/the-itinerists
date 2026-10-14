import { Injectable, inject } from '@angular/core';
import { ErrorLoggerService } from './error-logger.service';
import { ClosedInviteTracker, StartTimes, startupReport } from '../utils/diagnostics';

/** A close with no server reply after this long gets a note. */
export const INVITE_CLOSE_SLOW_MS = 10_000;

/**
 * Notes in `_appLogs` (type 'diagnostic') for problems the owner saw but
 * couldn't pin down: a closed invite coming back (#484) and a slow start
 * (#485). Each note says what happened and how long it took, never what was
 * written.
 */
@Injectable({ providedIn: 'root' })
export class DiagnosticsService {
  private logger  = inject(ErrorLoggerService);
  private invites = new ClosedInviteTracker();
  private startSeen = false;
  private authMs: number | null = null;
  private from: 'launch' | 'sign-in' = 'launch';
  /** When the timed start began: launch (0), or the moment of a hand sign-in; null while waiting for it. */
  private startedAt: number | null = 0;

  /** Runs an invite close, noting a failure or a long wait for the server. */
  async watchInviteClose(code: string, close: () => Promise<void>): Promise<void> {
    const slow = setTimeout(() =>
      this.logger.logDiagnostic(`invite close: no reply from the server after ${INVITE_CLOSE_SLOW_MS / 1000} s`), INVITE_CLOSE_SLOW_MS);
    try {
      await close();
      this.invites.closed(code, Date.now());
    } catch (e) {
      this.logger.logDiagnostic(`invite close failed: ${(e as { code?: string })?.code ?? 'unknown error'}`);
      throw e;
    } finally {
      clearTimeout(slow);
    }
  }

  /** Each update of the open trip's live invites. */
  invitesSeen(liveCodes: readonly string[], meta: { fromCache: boolean; pendingWrites: boolean }): void {
    const report = this.invites.check(liveCodes, meta, Date.now());
    if (report) this.logger.logDiagnostic(report);
  }

  /**
   * Called as start-up state changes (AppComponent): once the open trip is
   * ready, notes the start if it was slow (#485). `now` is ms since launch.
   */
  startupTick(s: { authKnown: boolean; signedIn: boolean; ready: boolean; native: boolean }, now = performance.now()): void {
    if (this.startSeen) return;
    if (this.authMs === null) {
      if (!s.authKnown) return;
      this.authMs = now;
      if (!s.signedIn) { this.from = 'sign-in'; this.startedAt = null; }
    }
    if (this.startedAt === null) {
      if (!s.signedIn) return;
      this.startedAt = now;
    }
    if (s.signedIn && s.ready) this.startup({ authMs: this.authMs, readyMs: now - this.startedAt, from: this.from, native: s.native });
  }

  /** The first start of this session: how long until sign-in was known and the trip was ready. */
  startup(t: StartTimes): void {
    if (this.startSeen) return;
    this.startSeen = true;
    const report = startupReport(t);
    if (report) this.logger.logDiagnostic(report);
  }
}
