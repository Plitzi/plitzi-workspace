import type { BuiltinGlobalCallback } from '../../authoring/globalCallbacks';

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
 * after a login can read `{{ login.access_token }}` because this says the key exists.
 */
export const authCallbacks = {
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
    preview: {
      errors: { username: '', password: '', token: '' },
      success: '',
      access_token: '',
      expires_at: '',
      details: { id: '', username: '', email: '', verified: '', permissions: '' }
    }
  },
  refreshDetails: {
    source: 'auth',
    title: 'Auth Refresh Details',
    strictParams: true,
    params: {},
    preview: {
      errors: '',
      success: '',
      access_token: '',
      expires_at: '',
      details: { id: '', username: '', email: '', roles: '', permissions: '', verified: '' }
    }
  },
  logout: {
    source: 'auth',
    title: 'Auth Logout',
    strictParams: true,
    params: {}
  }
} satisfies Record<string, BuiltinGlobalCallback>;
