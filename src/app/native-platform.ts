import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/** True inside the iPhone app (Capacitor), false in a browser. A token so tests can choose. */
export const NATIVE_PLATFORM = new InjectionToken<boolean>('NATIVE_PLATFORM', {
  providedIn: 'root',
  factory: () => Capacitor.isNativePlatform(),
});
