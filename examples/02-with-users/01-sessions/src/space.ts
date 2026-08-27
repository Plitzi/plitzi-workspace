import { sampleSpace } from '@plitzi/example-space/space';
import {
  authLogin,
  authLogout,
  authorSpace,
  button,
  form,
  formControl,
  heading,
  named,
  onClick,
  onSubmit,
  paragraph
} from '@plitzi/sdk-authoring';

import type { AuthoredSpace, PageSpec } from '@plitzi/sdk-authoring';

/**
 * The sample space, plus what makes this example about people: a page to sign in on, and a page you only see once
 * you have.
 *
 * Declared here rather than shipped as another JSON so the wiring is readable — this file *is* the explanation.
 * The mechanism is the product's own: **two pages share one path and differ by `accessLevel`**, and the router
 * picks between them from whether the visitor is signed in. Nothing conditional is written into either page.
 */

/**
 * Submitting the form runs auth's `login`. The credentials are read off the trigger's own payload — a form fires
 * `onSubmit` with `values`, keyed by each control's `name` — which is why the controls below are named `username`
 * and `password`.
 *
 * Neither step says where it runs, and that is the point of the builders: a trigger fires on the element the flow
 * is declared on, and `authLogin` writes the action `login` on the module `auth` — the pair the runtime resolves a
 * step by. Getting either half wrong is what makes a button appear to do nothing at all.
 */
const loginFlow = [
  named('login', onSubmit()),
  authLogin({
    mode: 'normal',
    username: '{{login.values.username}}',
    password: '{{login.values.password}}'
  })
];

const field = (name: string, label: string, subType: 'text' | 'password', defaultValue: string): PageSpec['body'][0] =>
  formControl({ subType, name, label, defaultValue, required: true, slots: { input: 'authInput' } });

const signedOut: PageSpec = {
  name: 'Sign in',
  slug: '',
  accessLevel: 'public',
  class: 'authPage',
  body: [
    heading({ content: 'Sign in', subType: 'h1', variant: 'lg' }),
    form({
      idRef: 'login-form',
      // Without this the browser submits the form itself and the page navigates away; the interaction is what runs.
      managedByInteractions: true,
      method: 'post',
      class: 'authForm',
      flows: [loginFlow],
      children: [
        field('username', 'Username', 'text', 'ada'),
        field('password', 'Password', 'password', 'password'),
        button({ subType: 'submit', content: 'Sign in', class: 'authButton' })
      ]
    })
  ]
};

/**
 * The auth data source, published by the SDK from whoever is signed in. Its key is `auth` — the builder LABELS its
 * fields `user.*`, which is what you pick in the UI, but a binding names the source itself. On a server-rendered
 * page it is already filled in when the HTML leaves the server: the name is in the markup, not painted in after.
 */
const signedIn: PageSpec = {
  name: 'Signed in',
  slug: '',
  accessLevel: 'authenticated',
  class: 'authPage',
  body: [
    heading({ content: '', subType: 'h1', variant: 'lg', bind: { content: 'auth.details.username' } }),
    paragraph({ content: '', bind: { content: 'auth.details.email' } }),
    button({
      idRef: 'logout-button',
      subType: 'button',
      content: 'Sign out',
      class: 'authButton',
      flows: [[onClick(), authLogout()]]
    })
  ]
};

/**
 * The two pages, on the sample space's own palette.
 *
 * `--foreground` and `--background-inner` come from the space it is spread from, and the page paints its own
 * background from the same pair the text colour comes from: using one without the other is what makes a page
 * unreadable in dark mode.
 *
 * `sessionHintCookie` is a parameter because it has to match the session cookie the server was configured with,
 * and that is the deployment's name for it — the sibling MySQL example renders these same two pages under its own.
 */
export const offlineData = (options: { sessionHintCookie?: string } = {}): AuthoredSpace =>
  authorSpace({
    ...sampleSpace,
    name: 'Sessions example',
    permanentUrl: 'sessions-example',
    classes: {
      ...sampleSpace.classes,
      authPage: {
        desktop: {
          display: 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
          'justify-content': 'center',
          gap: '16px',
          'min-height': '100vh',
          'font-family': 'system-ui, sans-serif',
          'background-color': 'var(--background-inner)',
          color: 'var(--foreground)'
        }
      },
      authForm: {
        desktop: { display: 'flex', 'flex-direction': 'column', gap: '12px', 'min-width': '280px' }
      },
      authInput: {
        desktop: {
          width: '100%',
          padding: '8px 10px',
          border: '1px solid #94a3b8',
          'border-radius': '6px',
          'font-size': '14px',
          'background-color': 'var(--background-inner)',
          color: 'var(--foreground)'
        }
      },
      authButton: {
        desktop: {
          padding: '8px 16px',
          'border-radius': '6px',
          border: '0px solid transparent',
          'background-color': '#5c3df5',
          color: '#ffffff',
          'font-size': '14px',
          cursor: 'pointer'
        }
      }
    },
    /**
     * What the browser half of auth needs to know. `basic` is the built-in provider — HTTP + JSON — and these are
     * the endpoints it calls; same origin, because this server serves both the page and the API.
     *
     * `sessionHintCookie` is the one worth understanding: a readable cookie carrying only expiry timestamps, so a
     * page can tell that nobody is signed in — the common case — without asking the server at all.
     */
    settings: {
      userProvider: 'basic',
      loginUrl: '/auth/login',
      userUrl: '/auth/session',
      refreshUrl: '/auth/refresh',
      logoutUrl: '/auth/logout',
      sessionHintCookie: options.sessionHintCookie ?? 'example_session_hint'
    },
    /**
     * These two REPLACE the sample page rather than joining it. All three would sit at `/`, and a page with no
     * `accessLevel` matches whether or not anybody is signed in — so it competes with both of these for the same
     * path, and which one wins comes down to sort order. Two pages at one path is the point here; three is an
     * ambiguity nobody can read off the schema.
     */
    pages: [signedOut, signedIn]
  });
