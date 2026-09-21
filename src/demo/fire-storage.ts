/** Demo-build stand-in for `@angular/fire/storage`: nothing is uploaded anywhere. */
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

export class FirebaseStorage {}

export function getStorage(_app?: unknown): FirebaseStorage { return new FirebaseStorage(); }
export function provideStorage(factory: () => FirebaseStorage): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: FirebaseStorage, useFactory: factory }]);
}
