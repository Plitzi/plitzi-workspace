import type { Element, ElementInteraction, OfflineDataRaw } from '@plitzi/sdk-shared';

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

type Definition = Partial<Element['definition']>;

const el = (id: string, rootId: string, definition: Definition, attributes: Record<string, unknown> = {}): Element =>
  ({
    id,
    attributes,
    definition: { rootId, parentId: rootId, styleSelectors: { base: '' }, ...definition }
  }) as Element;

/** A step in an interaction flow. The flow is an ordered list expressed as a linked list of nodes. */
const step = (
  id: string,
  flowId: string,
  type: 'trigger' | 'globalCallback',
  action: string,
  elementId: string,
  params: Record<string, unknown> = {},
  links: { beforeNode?: string; afterNode?: string } = {}
): ElementInteraction => ({
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

/** Submitting the form runs auth's `login`. The credentials come off the trigger's own payload — a form fires
 *  `onSubmit` with `values`, keyed by each control's `name` — which is why the controls are named `username` and
 *  `password`. `action` is the name the callback is REGISTERED under, and a name that resolves to nothing fails
 *  the step silently: the button appears to do nothing at all. */
const loginFlowFor = (formId: string): Record<string, ElementInteraction> => ({
  [`${formId}-trigger`]: step(
    `${formId}-trigger`,
    `${formId}-flow`,
    'trigger',
    'onSubmit',
    formId,
    {},
    {
      afterNode: `${formId}-call`
    }
  ),
  [`${formId}-call`]: step(
    `${formId}-call`,
    `${formId}-flow`,
    'globalCallback',
    'login',
    // A global callback names the module that registered it, not an element: auth's callbacks live on `auth`.
    'auth',
    {
      mode: 'normal',
      username: `{{${formId}-trigger.values.username}}`,
      password: `{{${formId}-trigger.values.password}}`
    },
    { beforeNode: `${formId}-trigger` }
  )
});

const logoutFlow = (ref: string): Record<string, ElementInteraction> => ({
  [`${ref}-trigger`]: step(
    `${ref}-trigger`,
    `${ref}-flow`,
    'trigger',
    'onClick',
    ref,
    {},
    {
      afterNode: `${ref}-call`
    }
  ),
  [`${ref}-call`]: step(
    `${ref}-call`,
    `${ref}-flow`,
    'globalCallback',
    'logout',
    'auth',
    {},
    {
      beforeNode: `${ref}-trigger`
    }
  )
});

const bind = (id: string, source: string, to: string) => ({ id, source, to, enabled: true });

/** `/` for a visitor. `accessLevel: 'public'` means guests ONLY — once somebody signs in this page stops
 *  matching, and its sibling takes the path. */
const guestHome: Record<string, Element> = {
  [AUTH_PAGES.guestHome]: el(
    AUTH_PAGES.guestHome,
    AUTH_PAGES.guestHome,
    {
      label: 'Home (guest)',
      type: 'page',
      parentId: undefined,
      items: ['guest-title', 'guest-copy', 'guest-login-link']
    },
    { slug: '', default: true, name: 'Home', accessLevel: 'public' }
  ),
  'guest-title': el(
    'guest-title',
    AUTH_PAGES.guestHome,
    { label: 'Heading', type: 'heading', initialState: { visibility: true } },
    { subType: 'h1', content: 'Welcome, guest' }
  ),
  'guest-copy': el(
    'guest-copy',
    AUTH_PAGES.guestHome,
    { label: 'Paragraph', type: 'paragraph' },
    { content: 'You are not signed in.' }
  ),
  'guest-login-link': el(
    'guest-login-link',
    AUTH_PAGES.guestHome,
    { label: 'Link', type: 'link', items: ['guest-login-label'] },
    { href: AUTH_PAGES.login, mode: 'page' }
  ),
  'guest-login-label': el(
    'guest-login-label',
    AUTH_PAGES.guestHome,
    { label: 'Text', type: 'text', parentId: 'guest-login-link' },
    { content: 'Sign in' }
  )
};

/** The same `/`, for somebody signed in. Its heading is BOUND to the session, so seeing a name on it is the
 *  server having resolved an identity rather than markup that happens to say one. */
const memberHome: Record<string, Element> = {
  [AUTH_PAGES.memberHome]: el(
    AUTH_PAGES.memberHome,
    AUTH_PAGES.memberHome,
    {
      label: 'Home (member)',
      type: 'page',
      parentId: undefined,
      items: ['member-title', 'member-account-link', AUTH_REFS.homeLogout]
    },
    { slug: '', default: false, name: 'Home', accessLevel: 'authenticated' }
  ),
  'member-title': el(
    'member-title',
    AUTH_PAGES.memberHome,
    {
      label: 'Heading',
      type: 'heading',
      initialState: { visibility: true },
      bindings: { attributes: [bind('b-home-name', 'auth.details.username', 'content')] }
    },
    { subType: 'h1', content: '' }
  ),
  'member-account-link': el(
    'member-account-link',
    AUTH_PAGES.memberHome,
    { label: 'Link', type: 'link', items: ['member-account-label'] },
    { href: AUTH_PAGES.account, mode: 'page' }
  ),
  'member-account-label': el(
    'member-account-label',
    AUTH_PAGES.memberHome,
    { label: 'Text', type: 'text', parentId: 'member-account-link' },
    { content: 'Your account' }
  ),
  [AUTH_REFS.homeLogout]: el(
    AUTH_REFS.homeLogout,
    AUTH_PAGES.memberHome,
    { label: 'Sign out', type: 'button', interactions: logoutFlow(AUTH_REFS.homeLogout) },
    { subType: 'button', content: 'Sign out' }
  )
};

/** `/login`, guests only. Signing in makes it inaccessible to the very visitor who just used it — so it redirects
 *  instead of refusing, which is what lands you on the member home the moment the session exists. */
const loginPage: Record<string, Element> = {
  [AUTH_PAGES.login]: el(
    AUTH_PAGES.login,
    AUTH_PAGES.login,
    { label: 'Sign in', type: 'page', parentId: undefined, items: ['login-title', AUTH_REFS.loginForm] },
    {
      slug: 'login',
      default: false,
      name: 'Sign in',
      accessLevel: 'public',
      unauthorizedBehaviour: 'redirect',
      unauthorizedPageRedirect: '/'
    }
  ),
  'login-title': el(
    'login-title',
    AUTH_PAGES.login,
    { label: 'Heading', type: 'heading', initialState: { visibility: true } },
    { subType: 'h1', content: 'Sign in' }
  ),
  [AUTH_REFS.loginForm]: el(
    AUTH_REFS.loginForm,
    AUTH_PAGES.login,
    {
      label: 'Login form',
      type: 'form',
      items: ['login-username', 'login-password', 'login-submit'],
      interactions: loginFlowFor(AUTH_REFS.loginForm)
    },
    // Without this the browser submits the form itself and the page navigates away; the interaction is what runs.
    { managedByInteractions: true, method: 'post' }
  ),
  'login-username': el(
    'login-username',
    AUTH_PAGES.login,
    { label: 'Username', type: 'formControl', parentId: AUTH_REFS.loginForm },
    { subType: 'text', name: 'username', label: 'Username', required: true }
  ),
  'login-password': el(
    'login-password',
    AUTH_PAGES.login,
    { label: 'Password', type: 'formControl', parentId: AUTH_REFS.loginForm },
    { subType: 'password', name: 'password', label: 'Password', required: true }
  ),
  'login-submit': el(
    'login-submit',
    AUTH_PAGES.login,
    { label: 'Sign in', type: 'button', parentId: AUTH_REFS.loginForm },
    { subType: 'submit', content: 'Sign in' }
  )
};

/** `/account`, members only, and a guest asking for it is sent to `/login` rather than told it exists. Three
 *  bindings, so a spec can tell a page that reads the session from one that merely renders. */
const accountPage: Record<string, Element> = {
  [AUTH_PAGES.account]: el(
    AUTH_PAGES.account,
    AUTH_PAGES.account,
    {
      label: 'Account',
      type: 'page',
      parentId: undefined,
      items: ['account-title', 'account-name', 'account-email', AUTH_REFS.accountLogout]
    },
    {
      slug: 'account',
      default: false,
      name: 'Account',
      accessLevel: 'authenticated',
      unauthorizedBehaviour: 'redirect',
      unauthorizedPageRedirect: '/login'
    }
  ),
  'account-title': el(
    'account-title',
    AUTH_PAGES.account,
    { label: 'Heading', type: 'heading', initialState: { visibility: true } },
    { subType: 'h1', content: 'Your account' }
  ),
  'account-name': el(
    'account-name',
    AUTH_PAGES.account,
    {
      label: 'Username',
      type: 'paragraph',
      bindings: { attributes: [bind('b-account-name', 'auth.details.username', 'content')] }
    },
    { content: '' }
  ),
  'account-email': el(
    'account-email',
    AUTH_PAGES.account,
    {
      label: 'Email',
      type: 'paragraph',
      bindings: { attributes: [bind('b-account-email', 'auth.details.email', 'content')] }
    },
    { content: '' }
  ),
  [AUTH_REFS.accountLogout]: el(
    AUTH_REFS.accountLogout,
    AUTH_PAGES.account,
    {
      label: 'Sign out',
      type: 'button',
      interactions: logoutFlow(AUTH_REFS.accountLogout)
    },
    { subType: 'button', content: 'Sign out' }
  )
};

const CSS = `
.plitzi-component__page{display:flex;flex-direction:column;align-items:flex-start;gap:16px;padding:40px;min-height:100vh;font-family:system-ui,sans-serif;background:#ffffff;color:#17171c;}
.plitzi-component__form{display:flex;flex-direction:column;gap:12px;min-width:280px;}
.plitzi-component__input{padding:8px 10px;border:1px solid #94a3b8;border-radius:6px;}
.plitzi-component__button{padding:8px 16px;border-radius:6px;border:0;background:#5c3df5;color:#fff;cursor:pointer;}
.plitzi-component__link{color:#5c3df5;text-decoration:underline;cursor:pointer;}
`;

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

const probe = (id: string, titleId: string, rootId: string, name: string): Record<string, Element> => ({
  [id]: el(
    id,
    rootId,
    { label: 'Probe', type: 'apiContainer', items: [titleId], styleSelectors: { base: id } },
    { query: `${PROBE_PATH}/${name}`, method: 'get', subType: 'section', cache: true, staleTime: 60 }
  ),
  [titleId]: el(
    titleId,
    rootId,
    {
      label: 'Probe title',
      type: 'paragraph',
      parentId: id,
      styleSelectors: { base: titleId },
      bindings: { attributes: [bind(`b-${id}`, `apiContainer_${id}.data.name`, 'content')] }
    },
    { content: '' }
  )
});

/** `/always`, for everybody: the one page a sign-out leaves standing, along with the provider on it. */
const probePage: Record<string, Element> = {
  [AUTH_PROBE.page]: el(
    AUTH_PROBE.page,
    AUTH_PROBE.page,
    { label: 'Always', type: 'page', parentId: undefined, items: [AUTH_PROBE.always, AUTH_PROBE.logout] },
    { slug: 'always', default: false, name: 'Always' }
  ),
  ...probe(AUTH_PROBE.always, AUTH_PROBE.alwaysTitle, AUTH_PROBE.page, 'always'),
  [AUTH_PROBE.logout]: el(
    AUTH_PROBE.logout,
    AUTH_PROBE.page,
    { label: 'Sign out', type: 'button', interactions: logoutFlow(AUTH_PROBE.logout) },
    { subType: 'button', content: 'Sign out here' }
  )
};

/** The member home with a provider of its own — one that mounts the moment somebody signs in. */
const memberHomeWithProbe: Record<string, Element> = {
  ...memberHome,
  [AUTH_PAGES.memberHome]: {
    ...memberHome[AUTH_PAGES.memberHome],
    definition: {
      ...memberHome[AUTH_PAGES.memberHome].definition,
      items: [...(memberHome[AUTH_PAGES.memberHome].definition.items ?? []), AUTH_PROBE.member]
    }
  },
  ...probe(AUTH_PROBE.member, AUTH_PROBE.memberTitle, AUTH_PAGES.memberHome, 'member')
};

export type AuthSpaceOptions = {
  /** Must match the session cookie the server was configured with — it is the deployment's name for it. */
  sessionHintCookie?: string;
};

export const authSpace = ({ sessionHintCookie = 'e2e_session_hint' }: AuthSpaceOptions = {}): OfflineDataRaw =>
  ({
    schema: {
      definition: { name: 'auth-flow', permanentUrl: '' },
      variables: [],
      pageFolders: {},
      flat: { ...guestHome, ...memberHomeWithProbe, ...loginPage, ...accountPage, ...probePage },
      pages: [AUTH_PAGES.guestHome, AUTH_PAGES.memberHome, AUTH_PAGES.login, AUTH_PAGES.account, AUTH_PROBE.page],
      /** What the browser half of auth needs. `basic` is the built-in provider — HTTP + JSON — and these are the
       *  endpoints it calls, same origin. `sessionHintCookie` is a readable cookie carrying only expiry
       *  timestamps, so a page can tell that nobody is signed in without asking the server at all. */
      settings: {
        customCss: '',
        userProvider: 'basic',
        loginUrl: '/auth/login',
        userUrl: '/auth/session',
        refreshUrl: '/auth/refresh',
        logoutUrl: '/auth/logout',
        sessionHintCookie
      }
    },
    style: { cache: CSS }
  }) as unknown as OfflineDataRaw;
