import type { AuthSuccess } from './session/session';
import type { ApiClient, ApiResult } from '@pmodules/network';

export type CsrfToken = { token: string; headerName: string };

export type SignupBody = { username: string; email: string; password: string };

/**
 * The `/auth` flows this app uses, named once.
 *
 * Sign-in is the only one that needs a CSRF token, and it needs it for a reason worth stating: the server treats
 * a request from an origin it does not recognise as foreign, and a desktop window IS a cross-site origin to the
 * API. So the token from `GET /auth/csrf` is fetched and echoed for every unauthenticated write. Once there is a
 * session the bearer header exempts the request, and none of the rest carry one.
 */
export const createAuthApi = (api: ApiClient) => {
  const csrf = async (): Promise<string | undefined> => {
    const result = await api.request<CsrfToken>({ path: '/auth/csrf' });

    return result.ok ? result.data.token : undefined;
  };

  /** A write that happens before there is a session: fetch a token, then send it. */
  const signIn = async <T>(path: string, body: unknown): Promise<ApiResult<T>> =>
    api.request<T>({ path, method: 'POST', body, csrfToken: await csrf() });

  return {
    login: (username: string, password: string) => signIn<AuthSuccess>('/auth/login', { username, password }),
    signup: (body: SignupBody) => signIn<AuthSuccess>('/auth/signup', body),
    forgotPassword: (email: string) => signIn<{ success: boolean }>('/auth/forgot-password', { email }),
    resetPassword: (token: string, password: string) =>
      signIn<{ success: boolean }>('/auth/reset-password', { token, password }),
    resendVerification: (email: string) => signIn<{ success: boolean }>('/auth/resend-verification-email', { email }),
    validateAccount: (token: string) =>
      signIn<{ success: boolean; status?: string }>('/auth/validate-account', { token }),

    /**
     * `csrf: 'none'` on the server: the refresh token IS the credential, so there is nothing a foreign page could
     * cause by asking — it does not have one.
     */
    refresh: (refreshToken: string) =>
      api.request<AuthSuccess>({ path: '/auth/refresh', method: 'POST', body: { refresh_token: refreshToken } }),

    session: (token: string) => api.request<{ details?: unknown }>({ path: '/auth/session', token }),

    logout: (accessToken: string, refreshToken?: string) =>
      api.request<{ success: boolean }>({
        path: '/auth/logout',
        method: 'POST',
        token: accessToken,
        body: { refresh_token: refreshToken }
      })
  };
};

export type AuthApi = ReturnType<typeof createAuthApi>;

export default createAuthApi;
