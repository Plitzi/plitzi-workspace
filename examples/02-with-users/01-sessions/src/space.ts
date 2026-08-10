import { readOfflineData } from '@plitzi/example-space';

import type { Element, OfflineDataRaw } from '@plitzi/sdk-shared';

/**
 * The sample space, plus what makes this example about people: a page to sign in on, and a page you only see once
 * you have.
 *
 * Built here rather than shipped as another JSON so the wiring is readable — this file *is* the explanation. The
 * mechanism is the product's own: **two pages share one path and differ by `accessLevel`**, and the router picks
 * between them from whether the visitor is signed in. Nothing conditional is written into either page.
 */

const el = (
  id: string,
  definition: Partial<Element['definition']> & { idRef?: string },
  attributes: Record<string, unknown> = {}
): Element => {
  const { idRef, ...rest } = definition;

  return {
    id,
    // Interactions are wired by `idRef`, never by the opaque id — an element without one is not registered at all.
    ...(idRef ? { idRef } : {}),
    attributes,
    definition: { rootId: 'signed-out', styleSelectors: { base: '' }, ...rest }
  } as Element;
};

/** A step in an interaction flow. The flow is an ordered list expressed as a linked list of nodes. */
const step = (
  id: string,
  flowId: string,
  type: 'trigger' | 'globalCallback',
  action: string,
  elementId: string,
  params: Record<string, unknown> = {},
  links: { beforeNode?: string; afterNode?: string } = {}
) => ({
  id,
  flowId,
  type,
  action,
  elementId,
  params,
  title: action,
  preview: {},
  enabled: true,
  beforeNode: links.beforeNode ?? '',
  afterNode: links.afterNode ?? ''
});

/**
 * Submitting the form runs auth's `login`. The credentials are read off the trigger's own payload — a form fires
 * `onSubmit` with `values`, keyed by each control's `name` — which is why the controls below are named `username`
 * and `password`.
 *
 * `action` is the name the callback is REGISTERED under (`login`, `logout`), not the label the builder shows for it
 * (`Auth Login`): a step is resolved as `callbacks[elementId][action]`, and a name that resolves to nothing fails
 * the step silently — the button appears to do nothing at all.
 */
const loginFlow = {
  'login-trigger': step('login-trigger', 'login-flow', 'trigger', 'onSubmit', 'login-form', {}, {
    afterNode: 'login-call'
  }),
  'login-call': step(
    'login-call',
    'login-flow',
    'globalCallback',
    'login',
    // A global callback names the module that registered it, not an element: auth's callbacks live on `auth`.
    'auth',
    { mode: 'normal', username: '{{login-trigger.values.username}}', password: '{{login-trigger.values.password}}' },
    { beforeNode: 'login-trigger' }
  )
};

const logoutFlow = {
  'logout-trigger': step('logout-trigger', 'logout-flow', 'trigger', 'onClick', 'logout-button', {}, {
    afterNode: 'logout-call'
  }),
  'logout-call': step('logout-call', 'logout-flow', 'globalCallback', 'logout', 'auth', {}, {
    beforeNode: 'logout-trigger'
  })
};

const signedOutPage: Record<string, Element> = {
  'signed-out': el('signed-out', {
    label: 'Sign in',
    type: 'page',
    styleSelectors: { base: 'auth-page' },
    items: ['signed-out-title', 'login-form']
  }, { slug: '', default: true, name: 'Sign in', accessLevel: 'public' }),

  'signed-out-title': el('signed-out-title', {
    label: 'Heading',
    type: 'heading',
    parentId: 'signed-out',
    initialState: { visibility: true, styleVariant: { heading: { base: 'lg' } } }
  }, { subType: 'h1', content: 'Sign in' }),

  'login-form': el('login-form', {
    label: 'Login form',
    type: 'form',
    idRef: 'login-form',
    parentId: 'signed-out',
    styleSelectors: { base: 'auth-form' },
    items: ['login-username', 'login-password', 'login-submit'],
    interactions: loginFlow
  }, {
    // Without this the browser submits the form itself and the page navigates away; the interaction is what runs.
    managedByInteractions: true,
    method: 'post'
  }),

  'login-username': el('login-username', {
    label: 'Username',
    type: 'formControl',
    parentId: 'login-form',
    styleSelectors: { base: '', label: '', input: 'auth-input', error: '' }
  }, { subType: 'text', name: 'username', label: 'Username', defaultValue: 'ada', required: true }),

  'login-password': el('login-password', {
    label: 'Password',
    type: 'formControl',
    parentId: 'login-form',
    styleSelectors: { base: '', label: '', input: 'auth-input', error: '' }
  }, { subType: 'password', name: 'password', label: 'Password', defaultValue: 'password', required: true }),

  'login-submit': el('login-submit', {
    label: 'Sign in',
    type: 'button',
    parentId: 'login-form',
    styleSelectors: { base: 'auth-button' }
  }, { subType: 'submit', content: 'Sign in' })
};

const signedInPage: Record<string, Element> = {
  'signed-in': el('signed-in', {
    label: 'Signed in',
    type: 'page',
    rootId: 'signed-in',
    styleSelectors: { base: 'auth-page' },
    items: ['signed-in-title', 'signed-in-email', 'logout-button']
  }, { slug: '', default: false, name: 'Signed in', accessLevel: 'authenticated' }),

  /**
   * The auth data source, published by the SDK from whoever is signed in. Its key is `auth` — the builder LABELS its
   * fields `user.*`, which is what you pick in the UI, but a binding names the source itself. On a server-rendered
   * page it is already filled in when the HTML leaves the server: the name is in the markup, not painted in after.
   */
  'signed-in-title': el('signed-in-title', {
    label: 'Heading',
    type: 'heading',
    rootId: 'signed-in',
    parentId: 'signed-in',
    initialState: { visibility: true, styleVariant: { heading: { base: 'lg' } } },
    bindings: {
      attributes: [{ id: 'b-name', source: 'auth.details.username', to: 'content', enabled: true }]
    }
  }, { subType: 'h1', content: '' }),

  'signed-in-email': el('signed-in-email', {
    label: 'Email',
    type: 'paragraph',
    rootId: 'signed-in',
    parentId: 'signed-in',
    bindings: {
      attributes: [{ id: 'b-email', source: 'auth.details.email', to: 'content', enabled: true }]
    }
  }, { content: '' }),

  'logout-button': el('logout-button', {
    label: 'Sign out',
    type: 'button',
    idRef: 'logout-button',
    rootId: 'signed-in',
    parentId: 'signed-in',
    styleSelectors: { base: 'auth-button' },
    interactions: logoutFlow
  }, { subType: 'button', content: 'Sign out' })
};

/**
 * The sample space defines `--foreground` and `--background-inner` and flips both per colour scheme. Using one
 * without the other is what makes a page unreadable in dark mode: near-white text on the browser's white default.
 * So the page paints its own background from the same pair the text colour comes from.
 */
const CSS = `
.auth-page{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;min-height:100vh;font-family:system-ui,sans-serif;background:var(--background-inner,#fff);color:var(--foreground,#17171c);}
.auth-form{display:flex;flex-direction:column;gap:12px;min-width:280px;}
.auth-form label{color:var(--foreground,#17171c);}
.auth-input{width:100%;padding:8px 10px;border:1px solid #94a3b8;border-radius:6px;font-size:14px;background:var(--background-inner,#fff);color:var(--foreground,#17171c);}
.auth-button{padding:8px 16px;border-radius:6px;border:0;background:#5c3df5;color:#fff;font-size:14px;cursor:pointer;}
`;

/** The sample space with the two auth pages added, as the server's adapters want it. */
export const offlineData = (): OfflineDataRaw => {
  const data = readOfflineData() as OfflineDataRaw;

  return {
    ...data,
    schema: {
      ...data.schema,
      flat: { ...data.schema.flat, ...signedOutPage, ...signedInPage },
      // Ahead of the sample page, so `/` lands on one of these two.
      pages: ['signed-out', 'signed-in', ...data.schema.pages],
      settings: { ...data.schema.settings, userProvider: 'basic' }
    },
    style: { ...data.style, cache: `${data.style.cache ?? ''}${CSS}` }
  };
};
