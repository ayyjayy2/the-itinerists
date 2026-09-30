/* Demo build stand-in for @angular/fire/analytics: the demo never reports anything. */
import { EnvironmentProviders, Injectable } from '@angular/core';

export class Analytics {}
export function getAnalytics(_app?: unknown): Analytics { return new Analytics(); }
export function provideAnalytics(_factory: () => Analytics): EnvironmentProviders { return [] as unknown as EnvironmentProviders; }
@Injectable({ providedIn: 'root' }) export class ScreenTrackingService {}
@Injectable({ providedIn: 'root' }) export class UserTrackingService {}
export function setUserProperties(_a: Analytics, _props: Record<string, unknown>): void {}
export function logEvent(_a: Analytics, _name: string, _params?: Record<string, unknown>): void {}
