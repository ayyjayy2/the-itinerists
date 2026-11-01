import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { publicOrigin } from '../utils/public-origin';

/**
 * A link to `path` that someone else can open: this site's address on the
 * web, the public site in the iPhone app, whose own address
 * (capacitor://localhost) works for nobody else (#658).
 */
export function publicLink(path: string): string {
  return publicOrigin(location.origin, Capacitor.isNativePlatform(), environment.firebase.projectId) + path;
}
