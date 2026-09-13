import type { BuiltinGlobalCallback } from '@plitzi/sdk-shared/authoring/builder';

/**
 * The auth source's three actions.
 *
 * The KEY of each entry is the name a document names it by — `auth.login`, not `auth.authLogin`. That is not a
 * cosmetic choice: `InteractionsManager` registers a callback under the key it is handed and `InteractionsHelper`
 * resolves a step as `callbacksAvailables[<source>][<action>]`, so a catalog key that differs from the
 * registration key is a step that resolves to nothing. These three used to be declared as `authLogin`,
 * `authLogout` and `authRefreshDetails` while the source registered them as `login`, `logout` and
 * `refreshDetails`, and every flow written from the catalog silently did nothing. {@link toInteractionCallbacks}
 * is what makes the two the same string now.
 *
 * The names carry no provider in them on purpose. A space names `auth.login` whether the session is verified by
 * Plitzi or by a self-hosted server's own accounts — the three calls are the auth context's, and every provider
 * implements them.
 *
 * `login` takes four params, and the catalog that used to mirror this said it took none — an agent authoring a
 * sign-in flow was told the credentials had nowhere to go. One declaration is what stops that from being possible.
 *
 * The previews matter as much as the params: they are the shape of what lands in the flow scope, so a step written
 * after a login can read `{{ login.accessToken }}` because this says the key exists. That makes a preview which does
 * not match what the callback RETURNS worse than no preview at all — and these did not: they promised
 * `access_token`, `success` and a `details` object, while `AuthContext.login` has always answered with a
 * {@link TokenResult}. Every sign-in flow written from this catalog therefore guarded on a key that is never there,
 * and the shape of that failure is a login which succeeds — cookies and all — while the page insists the
 * credentials were wrong and never goes anywhere.
 *
 * There is no user on a `TokenResult`, deliberately: who the session belongs to is loaded separately and arrives on
 * the `auth` source, not out of this step. A flow that wants to greet somebody by name reads what they typed, or
 * reads `auth.user` on a later render.
 */
export const authCallbacks: Record<string, BuiltinGlobalCallback> = {
  login: {
    source: 'auth',
    title: 'Auth Login',
    strictParams: true,
    params: {
      mode: {
        type: 'select',
        description: 'Credentials to sign in with: a username and password, or a token obtained elsewhere.',
        default: 'normal',
        options: ['normal', 'token'],
        optionLabels: { normal: 'User and Password', token: 'Token' },
        canBind: false
      },
      username: { type: 'text', description: 'Username.', default: '', when: params => params.mode === 'normal' },
      password: { type: 'text', description: 'Password.', default: '', when: params => params.mode === 'normal' },
      token: {
        type: 'text',
        description: 'A token to exchange for a session.',
        default: '',
        when: params => params.mode === 'token'
      }
    },
    /**
     * `ok` and `reason` are half of what a sign-in screen is for. A refusal resolves `{ ok: false, reason }` and
     * nothing else — `unverified` for an address that has never answered, `inactive` for an account that may not be
     * used, `network` for a backend that said nothing at all — so the page can write the sentence that is true
     * instead of the one that covers every case and fits none.
     */
    preview: {
      // A preview states the KEYS that land in scope; every value in one is a placeholder, `ok` included.
      ok: '',
      reason: '',
      errors: { username: '', password: '', token: '' },
      accessToken: '',
      expiresAt: '',
      refreshToken: ''
    }
  },
  refreshDetails: {
    source: 'auth',
    title: 'Auth Refresh Details',
    strictParams: true,
    params: {},
    preview: { errors: '', accessToken: '', expiresAt: '', refreshToken: '' }
  },
  logout: {
    source: 'auth',
    title: 'Auth Logout',
    strictParams: true,
    params: {}
  }
};
