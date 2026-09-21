/** Demo-build stand-in for `@angular/fire/app-check`: App Check is never activated. */
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

export class AppCheck {}
export class ReCaptchaV3Provider { constructor(readonly siteKey: string) {} }

export function initializeAppCheck(_app: unknown, _options: unknown): AppCheck { return new AppCheck(); }
export function provideAppCheck(_factory: () => AppCheck): EnvironmentProviders {
  return makeEnvironmentProviders([]);
}
