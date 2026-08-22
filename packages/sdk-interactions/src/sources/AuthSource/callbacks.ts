import type { BuiltinGlobalCallback } from '../../authoring/globalCallbacks';

/**
 * The auth source's three actions.
 *
 * `authLogin` takes four params, and the catalog that used to mirror this said it took none — an agent authoring a
 * sign-in flow was told the credentials had nowhere to go. One declaration is what stops that from being possible.
 *
 * The previews matter as much as the params: they are the shape of what lands in the flow scope, so a step written
 * after a login can read `{{ login.access_token }}` because this says the key exists.
 */
export const authCallbacks: Record<string, BuiltinGlobalCallback> = {
  authLogin: {
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
  authRefreshDetails: {
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
  authLogout: {
    source: 'auth',
    title: 'Auth Logout',
    strictParams: true,
    params: {}
  }
};
