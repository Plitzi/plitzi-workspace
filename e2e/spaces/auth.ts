import {
  apiContainer,
  authLogin,
  authLogout,
  authorSpace,
  button,
  form,
  formControl,
  heading,
  link,
  named,
  onClick,
  onSubmit,
  paragraph,
  text
} from '@plitzi/sdk-authoring';

import type { AuthoredSpace, ElementSpec } from '@plitzi/sdk-authoring';

/** A space with people in it, built for one purpose: to be walked end to end.
 *
 *  It carries the two mechanisms a real site uses to keep a visitor out of somewhere, because they are different
 *  and both break differently:
 *
 *  - **Two pages at one path**, told apart by `accessLevel`. `/` is the guest page for a visitor and the member
 *    page for somebody signed in. Nothing conditional is written into either one; the router picks.
 *  - **A protected path** — `/account` is `authenticated` and redirects a guest to `/login`. The page a visitor
 *    may not see does not exist for them at all.
 *
 *  And it reads the session through **bindings**, so what is on screen is the account rather than markup that was
 *  told about the account. */

export const AUTH_PAGES = {
  guestHome: 'guest-home',
  memberHome: 'member-home',
  login: 'login-page',
  account: 'account-page'
};

export const AUTH_REFS = {
  loginForm: 'login-form',
  homeLogout: 'home-logout',
  accountLogout: 'account-logout'
};

export const AUTH_PROBE = {
  page: 'probe-page',
  member: 'probe-member',
  memberTitle: 'probe-member-title',
  always: 'probe-always',
  alwaysTitle: 'probe-always-title',
  logout: 'probe-logout'
};

/** Submitting the form runs auth's `login`. The credentials come off the trigger's own payload — a form fires
 *  `onSubmit` with `values`, keyed by each control's `name` — which is why the controls are named `username` and
 *  `password`. `action` is the name the callback is REGISTERED under, and a name that resolves to nothing fails
 *  the step silently: the button appears to do nothing at all. */
const loginFlow = (formId: string) => [
  named(`${formId}-trigger`, onSubmit()),
  named(
    `${formId}-call`,
    authLogin({
      mode: 'normal',
      username: `{{${formId}-trigger.values.username}}`,
      password: `{{${formId}-trigger.values.password}}`
    })
  )
];

const signOut = (id: string, content = 'Sign out') =>
  button({ id, content, flows: [[named(`${id}-trigger`, onClick()), named(`${id}-call`, authLogout())]] });

const linkTo = (id: string, page: string, label: string) =>
  link({ id, href: page, mode: 'page', children: [text(label, { id: `${id.replace(/-link$/, '')}-label` })] });

/**
 * A provider on each side of the door, for what the query cache does when the session changes.
 *
 * Forgetting the previous person's answers is the whole point of a reset, and asking again is right when somebody
 * else is now looking — but only for what is still on screen and was already answered. `member` mounts BECAUSE of
 * the sign-in, so it asks for itself and must not be asked a second time; `always` is on a page with no access level
 * at all, so it survives the sign-out and is the one that used to answer 401 on the way out.
 */

/** Answered by the auth server itself (see `server/authServer.ts`), so nothing here ever 404s. */
export const PROBE_PATH = '/__e2e/session';

const probe = (id: string, titleId: string, name: string): ElementSpec =>
  apiContainer({
    id,
    query: `${PROBE_PATH}/${name}`,
    method: 'get',
    subType: 'section',
    cache: true,
    staleTime: 60,
    children: [paragraph('', { id: titleId, bind: { content: `${id}.data.name` } })]
  });

export type AuthSpaceOptions = {
  /** Must match the session cookie the server was configured with — it is the deployment's name for it. */
  sessionHintCookie?: string;
};

export const authSpace = ({ sessionHintCookie = 'e2e_session_hint' }: AuthSpaceOptions = {}): AuthoredSpace =>
  authorSpace({
    name: 'auth-flow',
    permanentUrl: 'auth-flow',
    /** What the browser half of auth needs. `basic` is the built-in provider — HTTP + JSON — and these are the
     *  endpoints it calls, same origin. `sessionHintCookie` is a readable cookie carrying only expiry
     *  timestamps, so a page can tell that nobody is signed in without asking the server at all. */
    settings: {
      userProvider: 'basic',
      loginUrl: '/auth/login',
      userUrl: '/auth/session',
      refreshUrl: '/auth/refresh',
      logoutUrl: '/auth/logout',
      sessionHintCookie
    },
    elements: {
      page: {
        base: {
          display: 'flex',
          'flex-direction': 'column',
          'align-items': 'flex-start',
          gap: '16px',
          padding: '40px',
          'min-height': '100vh',
          'font-family': 'system-ui, sans-serif',
          'background-color': '#ffffff',
          color: '#17171c'
        }
      },
      form: { base: { display: 'flex', 'flex-direction': 'column', gap: '12px', 'min-width': '280px' } },
      button: {
        base: {
          padding: '8px 16px',
          'border-radius': '6px',
          border: '0',
          'background-color': '#5c3df5',
          color: '#fff',
          cursor: 'pointer'
        }
      },
      link: { base: { color: '#5c3df5', 'text-decoration': 'underline', cursor: 'pointer' } },
      formControl: {
        slots: { input: { padding: '8px 10px', border: '1px solid #94a3b8', 'border-radius': '6px' } }
      }
    },
    pages: [
      /** `/` for a visitor. `accessLevel: 'public'` means guests ONLY — once somebody signs in this page stops
       *  matching, and its sibling takes the path. */
      {
        id: AUTH_PAGES.guestHome,
        name: 'Home',
        slug: '',
        isDefault: true,
        accessLevel: 'public',
        body: [
          heading('Welcome, guest', { id: 'guest-title', subType: 'h1' }),
          paragraph('You are not signed in.', { id: 'guest-copy' }),
          linkTo('guest-login-link', AUTH_PAGES.login, 'Sign in')
        ]
      },
      /** The same `/`, for somebody signed in. Its heading is BOUND to the session, so seeing a name on it is the
       *  server having resolved an identity rather than markup that happens to say one. */
      {
        id: AUTH_PAGES.memberHome,
        name: 'Home',
        slug: '',
        accessLevel: 'authenticated',
        body: [
          heading('', { id: 'member-title', subType: 'h1', bind: { content: 'auth.details.username' } }),
          linkTo('member-account-link', AUTH_PAGES.account, 'Your account'),
          signOut(AUTH_REFS.homeLogout),
          /** The member home with a provider of its own — one that mounts the moment somebody signs in. */
          probe(AUTH_PROBE.member, AUTH_PROBE.memberTitle, 'member')
        ]
      },
      /** `/login`, guests only. Signing in makes it inaccessible to the very visitor who just used it — so it redirects
       *  instead of refusing, which is what lands you on the member home the moment the session exists. */
      {
        id: AUTH_PAGES.login,
        name: 'Sign in',
        slug: 'login',
        accessLevel: 'public',
        unauthorizedRedirect: '/',
        body: [
          heading('Sign in', { id: 'login-title', subType: 'h1' }),
          form({
            id: AUTH_REFS.loginForm,
            // Without this the browser submits the form itself and the page navigates away; the flow is what runs.
            managedByInteractions: true,
            method: 'post',
            flows: [loginFlow(AUTH_REFS.loginForm)],
            children: [
              formControl({
                id: 'login-username',
                subType: 'text',
                name: 'username',
                label: 'Username',
                required: true
              }),
              formControl({
                id: 'login-password',
                subType: 'password',
                name: 'password',
                label: 'Password',
                required: true
              }),
              button({ id: 'login-submit', subType: 'submit', content: 'Sign in' })
            ]
          })
        ]
      },
      /** `/account`, members only, and a guest asking for it is sent to `/login` rather than told it exists. Three
       *  bindings, so a spec can tell a page that reads the session from one that merely renders. */
      {
        id: AUTH_PAGES.account,
        name: 'Account',
        slug: 'account',
        accessLevel: 'authenticated',
        unauthorizedRedirect: '/login',
        body: [
          heading('Your account', { id: 'account-title', subType: 'h1' }),
          paragraph('', { id: 'account-name', bind: { content: 'auth.details.username' } }),
          paragraph('', { id: 'account-email', bind: { content: 'auth.details.email' } }),
          signOut(AUTH_REFS.accountLogout)
        ]
      },
      /** `/always`, for everybody: the one page a sign-out leaves standing, along with the provider on it. */
      {
        id: AUTH_PROBE.page,
        name: 'Always',
        slug: 'always',
        body: [probe(AUTH_PROBE.always, AUTH_PROBE.alwaysTitle, 'always'), signOut(AUTH_PROBE.logout, 'Sign out here')]
      }
    ]
  });
