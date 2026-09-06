import type { DesktopUser } from './session/session';
import type { ApiClient } from '@pmodules/network';

/**
 * The `/auth` calls this app still makes, which is two.
 *
 * It used to make eight: sign in, sign up, forgot, reset, resend, validate, refresh, and a CSRF token for all of
 * them. Every one of those is now a screen in the browser — the platform's own sign-in — and what is left is
 * asking who a granted session belongs to, and ending it.
 *
 * Neither needs a CSRF token: both present a bearer, which exempts them. The token that starts it all is granted
 * by the OAuth flow in the main process (`electron/signIn.ts`), not by anything here.
 */
export const createAuthApi = (api: ApiClient) => ({
  /** Who a session belongs to. The grant answers with a token and nothing else. */
  session: (token: string) => api.request<{ details: DesktopUser }>({ path: '/auth/session', token }),

  logout: (accessToken: string) =>
    api.request<{ success: boolean }>({ path: '/auth/logout', method: 'POST', token: accessToken })
});

export type AuthApi = ReturnType<typeof createAuthApi>;

export default createAuthApi;
