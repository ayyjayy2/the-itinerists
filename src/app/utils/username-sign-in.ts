import { usernameSignInAddress } from './email';

/** Auth's answers that mean "no account with that address and password". */
const WRONG_SIGN_IN = ['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/user-not-found', 'auth/wrong-password'];

/**
 * Sign in an older account by its username (#712). Firebase Auth is asked first
 * with the address such accounts use (username@the-itinerists.local), so the
 * usual sign-in reads nothing from the database: that read had no time limit
 * and could hang the iPhone app. Only if Auth refuses is the username looked up,
 * for an account whose address differs or that now signs in with its email
 * ('use-email'). Otherwise Auth's own error is passed on.
 */
export async function signInByUsername(
  username: string,
  attempt: (address: string) => Promise<unknown>,
  lookup: () => Promise<{ authEmail?: string } | null>,
): Promise<'signed-in' | 'use-email'> {
  const usual = usernameSignInAddress(username, null) as string;
  try {
    await attempt(usual);
    return 'signed-in';
  } catch (err) {
    if (!WRONG_SIGN_IN.includes((err as { code?: string }).code ?? '')) throw err;
    const entry = await lookup().catch(() => null);
    if (!entry) throw err;
    const address = usernameSignInAddress(username, entry);
    if (address === 'use-email') return 'use-email';
    if (address === usual) throw err;
    await attempt(address);
    return 'signed-in';
  }
}
