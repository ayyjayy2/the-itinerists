/** Demo-build stand-in for `@angular/fire/app`: no Firebase app is ever created. */
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

export class FirebaseApp {
  readonly name = 'demo';
  constructor(readonly options: Record<string, unknown> = {}) {}
}

let app = new FirebaseApp();

export function initializeApp(options: Record<string, unknown>, _name?: string): FirebaseApp {
  app = new FirebaseApp(options);
  return app;
}
export function getApp(_name?: string): FirebaseApp { return app; }
export function provideFirebaseApp(factory: () => FirebaseApp): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: FirebaseApp, useFactory: factory }]);
}
