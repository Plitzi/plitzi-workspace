import { element } from '@plitzi/sdk-elements/authoring';
import { authorSpace } from '@plitzi/sdk-schema';

import type { ElementSpec, SpaceSpec, StyleRules } from '@plitzi/sdk-schema';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/**
 * The blog itself: four pages, declared.
 *
 * Nothing here is a component and nothing here fetches anything. A page is a tree of elements, some of which read
 * a data source by name, and the sources are published by the two `apiContainer`s that name a server action. The
 * space would open in the builder exactly as it reads here — this file is what dragging it together would save.
 *
 * `authorSpace` derives what nobody chooses: element ids, class names, parent and root links, the breakpoint maps.
 * What IS chosen is named — `idRef` on anything something else refers to, and `id` on any step whose result a
 * later one reads.
 */

const gap = (value: string): StyleRules => ({ 'row-gap': value, 'column-gap': value });

const padding = (value: string): StyleRules => ({
  'padding-top': value,
  'padding-right': value,
  'padding-bottom': value,
  'padding-left': value
});

const column = (value: string, extra: StyleRules = {}): StyleRules => ({
  display: 'flex',
  'flex-direction': 'column',
  ...gap(value),
  ...extra
});

const row = (value: string, extra: StyleRules = {}): StyleRules => ({
  display: 'flex',
  'flex-direction': 'row',
  ...gap(value),
  ...extra
});

/**
 * Longhands, and no `padding` or `gap` shorthand anywhere.
 *
 * The builder's style vocabulary is a closed list of properties and holds no shorthands, so a space authored with
 * them renders and then cannot be read back by the style editor. It stops here, at authoring time.
 */
const CLASSES: SpaceSpec['classes'] = {
  page: { desktop: column('0px', { 'min-height': '100vh', 'background-color': 'var(--background)' }) },
  header: {
    desktop: row('24px', {
      'align-items': 'center',
      'justify-content': 'space-between',
      width: '100%',
      'max-width': '720px',
      'margin-left': 'auto',
      'margin-right': 'auto',
      ...padding('24px'),
      'border-bottom-width': '1px',
      'border-bottom-style': 'solid',
      'border-bottom-color': 'var(--border)'
    })
  },
  nav: { desktop: row('18px', { 'align-items': 'center' }) },
  navLink: { desktop: { color: 'var(--muted)', 'text-decoration': 'none', 'font-size': '15px' } },
  main: {
    desktop: column('28px', {
      width: '100%',
      'max-width': '720px',
      'margin-left': 'auto',
      'margin-right': 'auto',
      ...padding('32px')
    })
  },
  card: {
    desktop: column('6px', {
      'padding-bottom': '24px',
      'border-bottom-width': '1px',
      'border-bottom-style': 'solid',
      'border-bottom-color': 'var(--border)'
    })
  },
  cardLink: { desktop: { 'text-decoration': 'none', color: 'var(--foreground)' } },
  cardTitle: { desktop: { 'font-size': '24px', 'font-weight': '600', 'margin-top': '0px', 'margin-bottom': '0px' } },
  byline: { desktop: { color: 'var(--muted)', 'font-size': '14px' } },
  excerpt: { desktop: { color: 'var(--foreground)', 'font-size': '16px', 'line-height': '1.6' } },
  body: { desktop: { color: 'var(--foreground)', 'font-size': '17px', 'line-height': '1.7' } },
  pager: { desktop: row('8px', { 'align-items': 'center', color: 'var(--muted)' }) },
  form: { desktop: column('14px', { 'max-width': '520px' }) },
  fieldRow: { desktop: column('4px') },
  fieldLabel: { desktop: { color: 'var(--muted)', 'font-size': '14px', 'font-weight': '600', cursor: 'pointer' } },
  input: {
    desktop: {
      width: '100%',
      ...padding('10px'),
      'border-top-width': '1px',
      'border-right-width': '1px',
      'border-bottom-width': '1px',
      'border-left-width': '1px',
      'border-top-style': 'solid',
      'border-right-style': 'solid',
      'border-bottom-style': 'solid',
      'border-left-style': 'solid',
      'border-top-color': 'var(--border)',
      'border-right-color': 'var(--border)',
      'border-bottom-color': 'var(--border)',
      'border-left-color': 'var(--border)',
      'border-top-left-radius': '6px',
      'border-top-right-radius': '6px',
      'border-bottom-right-radius': '6px',
      'border-bottom-left-radius': '6px',
      'background-color': 'var(--background)',
      color: 'var(--foreground)',
      'font-size': '15px',
      'font-family': 'inherit'
    }
  },
  button: {
    desktop: {
      ...padding('10px'),
      'padding-left': '18px',
      'padding-right': '18px',
      'border-top-width': '0px',
      'border-right-width': '0px',
      'border-bottom-width': '0px',
      'border-left-width': '0px',
      'border-top-left-radius': '6px',
      'border-top-right-radius': '6px',
      'border-bottom-right-radius': '6px',
      'border-bottom-left-radius': '6px',
      'background-color': 'var(--accent)',
      color: '#ffffff',
      'font-size': '15px',
      cursor: 'pointer',
      'align-self': 'flex-start'
    }
  },
  notice: { desktop: { color: 'var(--accent)', 'font-size': '15px', 'min-height': '20px' } }
};

const navLink = (label: string, href: string): ElementSpec =>
  element('Link', {
    // `internal` is a path this space serves; `page` would resolve a page id instead, and `external` leaves.
    attributes: { href, mode: 'internal' },
    className: 'navLink',
    children: [element('Text', { attributes: { content: label } })]
  });

/** The same masthead on every page, written once — which is what a class and a function each buy separately. */
const masthead = (): ElementSpec =>
  element('Container', {
    className: 'header',
    children: [
      element('Link', {
        attributes: { href: '/', mode: 'internal' },
        className: 'cardLink',
        children: [element('Heading', { attributes: { content: 'The Plitzi Post', subType: 'h1' }, className: 'cardTitle' })]
      }),
      element('Container', {
        className: 'nav',
        children: [navLink('Latest', '/'), navLink('Write', '/write'), navLink('Account', '/login')]
      })
    ]
  });

const heading = (content: string, subType = 'h2'): ElementSpec =>
  element('Heading', { attributes: { content, subType }, className: 'cardTitle' });

/**
 * One field.
 *
 * A form control is made of parts — a wrapper, a label, the input, an error — and `slots` is how a class reaches
 * one that is not the wrapper. Dressing it through `className` alone paints the box around the input instead.
 */
const field = (name: string, label: string, subType: string, extra: Record<string, unknown> = {}): ElementSpec =>
  element('FormControl', {
    attributes: { name, label, subType, required: true, ...extra },
    className: 'fieldRow',
    slots: { input: 'input', label: 'fieldLabel' }
  });

/**
 * Home.
 *
 * The `apiContainer` names an ACTION and renders on the server (`runtime: 'server'`), so its records are in the
 * HTML the first request answers. The list is a template rendered once per record, and each row publishes its own
 * `list_postList.item` — which is what the three bindings inside it read.
 */
const home: SpaceSpec['pages'][number] = {
  name: 'Latest posts',
  slug: '',
  idRef: 'home',
  seoTitle: 'The Plitzi Post',
  seoDescription: 'A small blog, served by Plitzi.',
  className: 'page',
  body: [
    masthead(),
    element('Container', {
      className: 'main',
      children: [
        element('ApiContainer', {
          idRef: 'posts',
          runtime: 'server',
          attributes: {
            action: 'list-posts',
            // The pager writes `?page=` and the server reads it back as the action's input. Both halves name the
            // same parameter, which is the whole of wiring them together.
            pagination: 'url',
            pageParam: 'page'
          },
          children: [
            element('List', {
              idRef: 'postList',
              attributes: { source: 'controlled' },
              bindings: [{ to: 'items', source: 'apiContainer_posts.records' }],
              style: { desktop: column('28px', { 'padding-left': '0px', 'margin-top': '0px', 'margin-bottom': '0px' }) },
              children: [
                element('Container', {
                  className: 'card',
                  children: [
                    element('Link', {
                      className: 'cardLink',
                      attributes: { mode: 'internal' },
                      bindings: [{ to: 'href', source: 'list_postList.item.url' }],
                      children: [
                        element('Heading', {
                          attributes: { subType: 'h2', content: '' },
                          className: 'cardTitle',
                          bindings: [{ to: 'content', source: 'list_postList.item.title' }]
                        })
                      ]
                    }),
                    element('Text', {
                      attributes: { content: '' },
                      className: 'byline',
                      bindings: [{ to: 'content', source: 'list_postList.item.byline' }]
                    }),
                    element('Paragraph', {
                      attributes: { content: '' },
                      className: 'excerpt',
                      bindings: [{ to: 'content', source: 'list_postList.item.excerpt' }]
                    })
                  ]
                })
              ]
            }),
            /**
             * The pager reads the provider's own `pageInfo` and nothing else, so it never talks to it: in URL mode
             * it writes the page into the address bar and the server resolves the window that URL asks for.
             *
             * It sits INSIDE the provider, because a provider publishes its source to its own subtree — and it
             * works there because the browser takes a server-rendered section over once hydration is done.
             */
            element('Pagination', {
              idRef: 'postPager',
              attributes: { mode: 'pages', target: 'url', pageParam: 'page' },
              className: 'pager',
              bindings: [{ to: 'pageInfo', source: 'apiContainer_posts.pageInfo' }]
            }),
            /**
             * The empty state, which is a binding rather than a mechanism of its own: a provider publishes
             * `isEmpty` beside its records, so "nothing here" is authorable with the elements that already exist.
             */
            element('Paragraph', {
              attributes: { content: 'No posts yet. Sign in as ada and write the first one.' },
              className: 'byline',
              bindings: [{ to: 'visibility', source: 'apiContainer_posts.isEmpty', category: 'initialState' }]
            })
          ]
        })
      ]
    })
  ]
};

/**
 * One post.
 *
 * `{{slug}}` in the page's own slug is what makes this a detail page: the router turns it into a route param, and
 * a render trigger's input is the page's route and query params — so the action reads `{{input.slug}}` and nothing
 * has to be wired between the URL and the flow.
 */
const post: SpaceSpec['pages'][number] = {
  name: 'Post',
  slug: 'post/{{slug}}',
  idRef: 'postPage',
  className: 'page',
  body: [
    masthead(),
    element('Container', {
      className: 'main',
      children: [
        element('ApiContainer', {
          idRef: 'post',
          runtime: 'server',
          attributes: { action: 'get-post', singleRecord: true },
          children: [
            element('Container', {
              className: 'card',
              // Two halves of one answer, each bound to a flag the action returned. A page for a slug nobody wrote
              // has to say so, and saying so is a binding rather than a branch.
              bindings: [{ to: 'visibility', source: 'apiContainer_post.found', category: 'initialState' }],
              children: [
                element('Heading', {
                  attributes: { subType: 'h1', content: '' },
                  className: 'cardTitle',
                  bindings: [{ to: 'content', source: 'apiContainer_post.record.title' }]
                }),
                element('Text', {
                  attributes: { content: '' },
                  className: 'byline',
                  bindings: [{ to: 'content', source: 'apiContainer_post.record.byline' }]
                })
              ]
            }),
            /**
             * `richText` and not `blockHtml`: the second executes what it is given on purpose, which is right for
             * an embed the site's own author pasted in and wrong for a body that came out of a store.
             */
            element('RichText', {
              attributes: { format: 'markdown', content: '' },
              className: 'body',
              bindings: [{ to: 'content', source: 'apiContainer_post.record.body' }]
            }),
            element('Paragraph', {
              attributes: { content: 'That post does not exist.' },
              className: 'byline',
              bindings: [{ to: 'visibility', source: 'apiContainer_post.missing', category: 'initialState' }]
            })
          ]
        })
      ]
    })
  ]
};

/**
 * Write.
 *
 * `authenticated`, so the router only offers it to a visitor with a session — and that is a convenience, not the
 * control: the action's own trigger asks for `postPublish` before it runs a step, which is why `grace` can open
 * this page and still not publish.
 */
const write: SpaceSpec['pages'][number] = {
  name: 'Write',
  slug: 'write',
  idRef: 'writePage',
  accessLevel: 'authenticated',
  // A visitor with no session lands on the sign-in rather than on a 403, which is the whole of "you must be
  // logged in to post" — stated on the page, not written into a guard somewhere.
  unauthorizedRedirect: 'login',
  className: 'page',
  body: [
    masthead(),
    element('Container', {
      className: 'main',
      children: [
        heading('New post', 'h1'),
        element('Form', {
          idRef: 'postForm',
          className: 'form',
          // Without this the browser submits the form itself and the page navigates away; the flow is what runs.
          attributes: { managedByInteractions: true, method: 'post' },
          flows: [
            [
              { id: 'submitted', type: 'trigger', action: 'onSubmit', on: 'postForm' },
              {
                /**
                 * Named, because the two steps after it read what it answered. The flow's scope is keyed by step
                 * id, so `{{publish.output.url}}` resolves only because this step is called `publish`.
                 *
                 * `runServerAction` is a GLOBAL callback: it names the module that registered it, not an element.
                 * The page hands over an action name and two values — never a URL, never a credential.
                 */
                id: 'publish',
                type: 'globalCallback',
                action: 'runServerAction',
                on: 'actions',
                params: {
                  actionId: 'publish-post',
                  input: '{"title":"{{submitted.values.title}}","body":"{{submitted.values.body}}"}',
                  // `await`, so the steps below have a result to read. `detached` would carry on immediately.
                  mode: 'await'
                }
              },
              {
                id: 'refused',
                type: 'globalCallback',
                action: 'setState',
                on: 'state',
                params: { key: 'notice', type: 'text', value: 'The server refused this: {{publish.reason}}' },
                // The refusal the server decided, shown by the page rather than guessed at by it.
                when: { combinator: 'and', rules: [{ field: 'publish.status', operator: '!=', value: 'completed' }] }
              },
              {
                id: 'published',
                type: 'globalCallback',
                action: 'navigate',
                on: 'navigation',
                // The post it just wrote, addressed by what the action answered. The page it lands on resolves its
                // own section on the way in, so this is an ordinary route change.
                params: { urlType: 'internal', url: '{{publish.output.url}}' },
                when: { combinator: 'and', rules: [{ field: 'publish.status', operator: '=', value: 'completed' }] }
              }
            ]
          ],
          children: [
            field('title', 'Title', 'text', { placeholder: 'A title' }),
            field('body', 'Body', 'textarea', { placeholder: 'Markdown is fine' }),
            element('Button', { attributes: { subType: 'submit', content: 'Publish' }, className: 'button' })
          ]
        }),
        element('Paragraph', {
          attributes: { content: '' },
          className: 'notice',
          bindings: [{ to: 'content', source: 'state.notice' }]
        })
      ]
    })
  ]
};

/**
 * Sign in, and the account — TWO pages on ONE path.
 *
 * `public` does not mean "for everybody": it means signed-out visitors, and it is one half of a pair. The router
 * picks between them from whether there is a session, so neither page contains a condition.
 */
const signIn: SpaceSpec['pages'][number] = {
  name: 'Sign in',
  slug: 'login',
  idRef: 'signInPage',
  accessLevel: 'public',
  className: 'page',
  body: [
    masthead(),
    element('Container', {
      className: 'main',
      children: [
        heading('Sign in', 'h1'),
        element('Paragraph', {
          attributes: { content: 'ada / password writes posts. grace / password may only read them.' },
          className: 'byline'
        }),
        element('Form', {
          idRef: 'loginForm',
          className: 'form',
          attributes: { managedByInteractions: true, method: 'post' },
          flows: [
            [
              { id: 'signIn', type: 'trigger', action: 'onSubmit', on: 'loginForm' },
              {
                // `login` is the name the callback is REGISTERED under, on the module `auth` — not the label the
                // builder shows for it. A name that resolves to nothing fails the step in silence.
                type: 'globalCallback',
                action: 'login',
                on: 'auth',
                params: {
                  mode: 'normal',
                  username: '{{signIn.values.username}}',
                  password: '{{signIn.values.password}}'
                }
              }
            ]
          ],
          children: [
            field('username', 'Username', 'text', { defaultValue: 'ada' }),
            field('password', 'Password', 'password', { defaultValue: 'password' }),
            element('Button', { attributes: { subType: 'submit', content: 'Sign in' }, className: 'button' })
          ]
        })
      ]
    })
  ]
};

const account: SpaceSpec['pages'][number] = {
  name: 'Account',
  slug: 'login',
  idRef: 'accountPage',
  accessLevel: 'authenticated',
  className: 'page',
  body: [
    masthead(),
    element('Container', {
      className: 'main',
      children: [
        /**
         * `auth` is the source the SDK publishes from whoever is signed in. On a server-rendered page it is
         * already filled in when the HTML leaves the server — the name is in the markup, not painted in after.
         */
        element('Heading', {
          attributes: { subType: 'h1', content: '' },
          className: 'cardTitle',
          bindings: [{ to: 'content', source: 'auth.details.username' }]
        }),
        element('Text', {
          attributes: { content: '' },
          className: 'byline',
          bindings: [{ to: 'content', source: 'auth.details.email' }]
        }),
        element('Button', {
          idRef: 'signOut',
          attributes: { subType: 'button', content: 'Sign out' },
          className: 'button',
          flows: [
            [
              { id: 'signOut', type: 'trigger', action: 'onClick', on: 'signOut' },
              { type: 'globalCallback', action: 'logout', on: 'auth' }
            ]
          ]
        })
      ]
    })
  ]
};

const blog: SpaceSpec = {
  name: 'The Plitzi Post',
  permanentUrl: 'blog',
  variables: {
    color: {
      foreground: { light: '#17171c', dark: '#f4f4f5', default: '#17171c' },
      muted: { light: '#6b7280', dark: '#a1a1aa', default: '#6b7280' },
      background: { light: '#ffffff', dark: '#111114', default: '#ffffff' },
      border: { light: '#e4e4e7', dark: '#27272a', default: '#e4e4e7' },
      accent: { light: '#5c3df5', dark: '#a394fb', default: '#5c3df5' }
    }
  },
  elements: {
    heading: { base: { color: 'var(--foreground)', 'margin-top': '0px', 'margin-bottom': '0px' } },
    paragraph: { base: { color: 'var(--foreground)', 'margin-top': '0px', 'margin-bottom': '0px' } },
    text: { base: { color: 'var(--foreground)' } },
    page: { base: { 'font-family': 'system-ui, sans-serif' } }
  },
  classes: CLASSES,
  /**
   * The switch that makes the two providers server-side. Without it their elements fall back to mock data and
   * nothing anywhere reports a missing setting.
   */
  rsc: { enabled: true },
  /**
   * What the browser half of auth needs: which provider, and the four endpoints it calls. `sessionHintCookie` is
   * a readable cookie carrying only expiry timestamps, so a page can tell that nobody is signed in — the common
   * case — without asking the server at all.
   */
  settings: {
    userProvider: 'basic',
    loginUrl: '/auth/login',
    userUrl: '/auth/session',
    refreshUrl: '/auth/refresh',
    logoutUrl: '/auth/logout',
    sessionHintCookie: 'blog_session_hint'
  },
  pages: [home, post, write, signIn, account]
};

export const offlineData = (): OfflineDataRaw => authorSpace(blog);
