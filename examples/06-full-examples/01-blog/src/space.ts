import { element } from '@plitzi/sdk-elements/authoring';
import { authorSpace } from '@plitzi/sdk-schema';

import { classes, customCss, elements, variables } from './theme';

import type { BindingSpec, ElementSpec, PageSpec, SpaceSpec } from '@plitzi/sdk-schema';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/**
 * The blog itself: five pages, declared.
 *
 * Nothing here is a component and nothing here fetches anything. A page is a tree of elements, some of which read
 * a data source by name, and the sources are published by the `apiContainer`s that name a server action. The space
 * would open in the builder exactly as it reads here — this file is what dragging it together would save.
 *
 * `authorSpace` derives what nobody chooses: element ids, class names, parent and root links, the breakpoint maps.
 * What IS chosen is named — `idRef` on anything something else refers to, and `id` on any step whose result a
 * later one reads.
 */

const text = (content: string, className: string): ElementSpec =>
  element('Text', { attributes: { content }, className });

const bound = (type: 'Text' | 'Paragraph', source: string, className: string): ElementSpec =>
  element(type, { attributes: { content: '' }, className, bindings: [{ to: 'content', source }] });

const heading = (source: string, className: string, subType = 'h2'): ElementSpec =>
  element('Heading', { attributes: { subType, content: '' }, className, bindings: [{ to: 'content', source }] });

const image = (source: string, className: string): ElementSpec =>
  element('Image', { attributes: { alt: '', loadMode: 'lazy' }, className, bindings: [{ to: 'src', source }] });

/** `internal` is a path this space serves; `page` would resolve a page id instead, and `external` leaves. */
const link = (href: string, className: string, children: ElementSpec[]): ElementSpec =>
  element('Link', { attributes: { href, mode: 'internal' }, className, children });

/**
 * The text inside a pill, button or link.
 *
 * One class for all of them, and the reason is worth stating: the box — the border, the padding, the radius —
 * belongs to the link, and giving the text the link's class draws the box a second time INSIDE the first. This
 * one carries no type of its own; it inherits every bit of it from whatever it sits in.
 */
const label = (content: string): ElementSpec => element('Text', { attributes: { content }, className: 'inlineLabel' });

/** A link whose destination is a field — a card, a headline, an item in a list of recent posts. */
const boundLink = (source: string, className: string, children: ElementSpec[]): ElementSpec =>
  element('Link', { attributes: { mode: 'internal' }, className, bindings: [{ to: 'href', source }], children });

/** Shows or hides an element from a boolean the server answered. Two halves of one page, no branch in either. */
const shownWhen = (source: string): BindingSpec => ({ to: 'visibility', source, category: 'initialState' });

/** An initial in a circle: no image to load, nothing to go missing, and it works for any name. */
const avatar = (source: string, className = 'avatar'): ElementSpec =>
  element('Text', { attributes: { content: '' }, className, bindings: [{ to: 'content', source }] });

/** Author, date and reading time in one line — composed on the server, because a binding names one field. */
const byline = (src: string): ElementSpec =>
  element('Container', {
    className: 'metaRow',
    children: [avatar(`${src}.initial`, 'avatarSm'), bound('Text', `${src}.byline`, 'meta')]
  });

/**
 * The header, and the only part of this space that changes with who is looking.
 *
 * It is an `apiContainer` naming the `site-chrome` action, so the answer comes from the session on the SERVER:
 * the editor link is hidden from anyone who may not use it, and the account button carries the name of whoever is
 * signed in. Hiding the link is a courtesy — the action behind it refuses the same people either way.
 *
 * One per page, because an idRef names one element in the whole space and the bindings below follow the ref.
 */
const chrome = (ref: string, body: ElementSpec[]): ElementSpec => {
  const src = `apiContainer_${ref}`;

  return element('ApiContainer', {
    idRef: ref,
    runtime: 'server',
    attributes: { action: 'site-chrome' },
    className: 'pageInner',
    children: [
      element('Container', {
        className: 'headerBand',
        children: [
          element('Container', {
            className: 'headerInner',
            children: [
              link('/', 'brand', [
                text('P', 'brandMark'),
                element('Container', {
                  className: 'stack',
                  children: [text('The Plitzi Post', 'brandName'), text('Built with Plitzi', 'brandTag')]
                })
              ]),
              element('Container', {
                className: 'nav',
                children: [
                  link('/', 'navLink', [label('Latest')]),
                  // Hidden unless the session holds `postPublish` — a dead end is bad manners, and that is all
                  // this is: the action behind the link refuses the same people either way.
                  element('Link', {
                    attributes: { href: '/write', mode: 'internal' },
                    className: 'navLink',
                    bindings: [shownWhen(`${src}.canWrite`)],
                    children: [label('Write')]
                  }),
                  /**
                   * Light and dark, as a control rather than as a setting of the visitor's machine.
                   *
                   * The element ships two icons and no colours: it writes the choice on the document root, and
                   * this space's palette — every colour here is a variable with a value per scheme — follows it.
                   * Which icon shows is a rule in `theme.ts`, answered the same way the palette is.
                   */
                  element('ThemeToggle', {
                    idRef: `${ref}Theme`,
                    attributes: { subType: 'switch', lightLabel: 'Light', darkLabel: 'Dark' },
                    className: 'themeToggle'
                  }),
                  /**
                   * Two controls, not one that changes its mind.
                   *
                   * A signed-out visitor gets an invitation and a signed-in one gets their own name — different
                   * shapes, so neither is a compromise between the two. Each binds its visibility to a fact the
                   * server answered, which is how a page says "either/or" without a condition in it.
                   */
                  element('Link', {
                    attributes: { href: '/login', mode: 'internal' },
                    className: 'signInLink',
                    bindings: [shownWhen(`${src}.signedOut`)],
                    children: [label('Sign in')]
                  }),
                  element('Link', {
                    attributes: { href: '/login', mode: 'internal' },
                    className: 'accountPill',
                    bindings: [shownWhen(`${src}.signedIn`)],
                    children: [avatar(`${src}.initial`, 'avatarSm'), bound('Text', `${src}.accountLabel`, 'bylineName')]
                  })
                ]
              })
            ]
          })
        ]
      }),
      ...body,
      footer()
    ]
  });
};

/**
 * "Write a post", shown only to somebody who may.
 *
 * The same rule as the one in the header, and the same source: an invitation to a page that will refuse you is
 * worse than no invitation. `ref` names the page's own chrome provider, since a source is read by the elements
 * BELOW the provider that publishes it and each page carries its own.
 */
const writeLink = (ref: string): ElementSpec =>
  element('Link', {
    attributes: { href: '/write', mode: 'internal' },
    className: 'chipQuiet',
    bindings: [shownWhen(`apiContainer_${ref}.canWrite`)],
    children: [label('Write a post')]
  });

const footer = (): ElementSpec =>
  element('Container', {
    className: 'footerBand',
    children: [
      element('Container', {
        className: 'footerInner',
        children: [
          element('Container', {
            className: 'brand',
            children: [
              text('P', 'brandMark'),
              element('Container', {
                className: 'stack',
                children: [
                  text('The Plitzi Post', 'brandName'),
                  text('A whole small blog, rendered by Plitzi.', 'meta')
                ]
              })
            ]
          }),
          element('Container', {
            className: 'footerEnd',
            children: [
              text('Seven files', 'footerLabel'),
              text('Posts, sessions and permissions — and no build step for the pages.', 'meta')
            ]
          })
        ]
      })
    ]
  });

/** One story in the main column: cover, topic, headline, excerpt, byline. */
const feedCard = (src: string): ElementSpec =>
  element('Container', {
    className: 'card',
    children: [
      boundLink(`${src}.url`, 'cardLink', [image(`${src}.cover`, 'cardImage')]),
      element('Container', {
        className: 'cardBody',
        children: [
          bound('Text', `${src}.topic`, 'chip'),
          boundLink(`${src}.url`, 'cardLink', [heading(`${src}.title`, 'cardTitle')]),
          bound('Paragraph', `${src}.excerpt`, 'cardExcerpt'),
          byline(src)
        ]
      })
    ]
  });

const panel = (title: string, children: ElementSpec[]): ElementSpec =>
  element('Container', {
    className: 'panel',
    children: [
      element('Heading', { attributes: { subType: 'h3', content: title }, className: 'panelTitle' }),
      ...children
    ]
  });

const note = (content: string): ElementSpec =>
  element('Paragraph', { attributes: { content }, className: 'panelText' });

const home: PageSpec = {
  name: 'Latest posts',
  slug: '',
  idRef: 'home',
  seoTitle: 'The Plitzi Post',
  seoDescription: 'A whole small blog — posts, sessions and permissions — rendered by Plitzi.',
  className: 'page',
  body: [
    chrome('chromeHome', [
      element('Container', {
        className: 'main',
        children: [
          /**
           * Everything on this page comes out of one provider.
           *
           * It names an ACTION and renders on the server (`runtime: 'server'`), so the records are in the HTML the
           * first request answers. `pagination: 'url'` and the pager below name the same query parameter, and the
           * action reads it as its input — which is the whole of wiring the two together.
           */
          element('ApiContainer', {
            idRef: 'posts',
            runtime: 'server',
            attributes: {
              action: 'list-posts',
              // What this element asks of the action, on top of the page's own route and query params.
              input: { perPage: 4, featured: true },
              pagination: 'url',
              pageParam: 'page'
            },
            className: 'pageStack',
            children: [
              element('Container', {
                className: 'hero',
                bindings: [shownWhen('apiContainer_posts.hasFeatured')],
                children: [
                  element('Container', {
                    className: 'heroText',
                    children: [
                      bound('Text', 'apiContainer_posts.featured.topic', 'chip'),
                      heading('apiContainer_posts.featured.title', 'heroTitle', 'h1'),
                      bound('Paragraph', 'apiContainer_posts.featured.standfirst', 'heroStandfirst'),
                      byline('apiContainer_posts.featured'),
                      boundLink('apiContainer_posts.featured.url', 'readLink', [label('Read the story')])
                    ]
                  }),
                  boundLink('apiContainer_posts.featured.url', 'frame', [
                    image('apiContainer_posts.featured.cover', 'heroImage')
                  ])
                ]
              }),
              element('Container', {
                className: 'layout',
                children: [
                  element('Container', {
                    className: 'feed',
                    children: [
                      text('More stories', 'sectionLabel'),
                      /**
                       * The list renders its one child once per record, each row under its own scope — which is what
                       * `list_postList.item` is. One template, however many posts.
                       */
                      element('List', {
                        idRef: 'postList',
                        attributes: { source: 'controlled' },
                        className: 'feed',
                        bindings: [{ to: 'items', source: 'apiContainer_posts.records' }],
                        children: [feedCard('list_postList.item')]
                      }),
                      /**
                       * The pager reads the provider's own `pageInfo` and nothing else, so it never talks to it: in
                       * URL mode it writes the page into the address bar and the server resolves the window that URL
                       * asks for — which keeps the result shareable, indexable and back-button-proof.
                       */
                      element('Pagination', {
                        idRef: 'postPager',
                        attributes: { mode: 'pages', target: 'url', pageParam: 'page' },
                        className: 'pager',
                        bindings: [{ to: 'pageInfo', source: 'apiContainer_posts.pageInfo' }]
                      })
                    ]
                  }),
                  element('Container', {
                    className: 'sidebar',
                    children: [
                      panel('About', [
                        note(
                          'A demonstration blog: every page here is a layout, every read is a flow the server runs, and publishing is a permission rather than a button.'
                        ),
                        writeLink('chromeHome')
                      ]),
                      /**
                       * A second provider, nested inside the first, asking the SAME action a different question:
                       * five posts, no lead story, always the first window. An element declares what it wants and the
                       * action answers it — there is no second endpoint here, and no second task.
                       */
                      element('ApiContainer', {
                        idRef: 'recent',
                        runtime: 'server',
                        attributes: { action: 'list-posts', input: { page: 1, perPage: 5, featured: false } },
                        className: 'sidebar',
                        children: [
                          panel('Topics', [
                            element('List', {
                              idRef: 'topicList',
                              attributes: { source: 'controlled' },
                              className: 'chipRow',
                              bindings: [{ to: 'items', source: 'apiContainer_recent.topics' }],
                              children: [
                                boundLink('list_topicList.item.url', 'chipQuiet', [
                                  bound('Text', 'list_topicList.item.name', 'inlineLabel')
                                ])
                              ]
                            })
                          ]),
                          panel('From the archive', [
                            element('List', {
                              idRef: 'recentList',
                              attributes: { source: 'controlled' },
                              className: 'quietList',
                              bindings: [{ to: 'items', source: 'apiContainer_recent.records' }],
                              children: [
                                boundLink('list_recentList.item.url', 'quietItem', [
                                  bound('Text', 'list_recentList.item.title', 'quietTitle'),
                                  bound('Text', 'list_recentList.item.date', 'meta')
                                ])
                              ]
                            })
                          ])
                        ]
                      })
                    ]
                  })
                ]
              }),
              /**
               * The empty state, which is a binding rather than a mechanism of its own: a provider publishes
               * `isEmpty` beside its records, so "nothing here" is authorable with the elements that already exist.
               */
              element('Paragraph', {
                attributes: { content: 'No posts yet. Sign in as ada and write the first one.' },
                className: 'panelText',
                bindings: [shownWhen('apiContainer_posts.isEmpty')]
              })
            ]
          })
        ]
      })
    ])
  ]
};

/**
 * One post.
 *
 * `{{slug}}` in the page's own slug is what makes this a detail page: the router turns it into a route param, and
 * a render trigger's input is the page's route and query params — so the action reads `{{input.slug}}` and nothing
 * has to be wired between the URL and the flow.
 */
const post: PageSpec = {
  name: 'Post',
  slug: 'post/{{slug}}',
  idRef: 'postPage',
  className: 'page',
  body: [
    chrome('chromePost', [
      element('Container', {
        className: 'main',
        children: [
          element('ApiContainer', {
            idRef: 'post',
            runtime: 'server',
            attributes: { action: 'get-post', singleRecord: true, subType: 'main' },
            className: 'pageStack',
            children: [
              element('Container', {
                className: 'article',
                // Two halves of one answer, each bound to a flag the action returned. A page for a slug nobody wrote
                // has to say so, and saying so is a binding rather than a branch.
                bindings: [shownWhen('apiContainer_post.found')],
                children: [
                  bound('Text', 'apiContainer_post.record.topic', 'chip'),
                  heading('apiContainer_post.record.title', 'articleTitle', 'h1'),
                  bound('Paragraph', 'apiContainer_post.record.standfirst', 'articleStandfirst'),
                  element('Container', {
                    className: 'metaRow',
                    children: [
                      avatar('apiContainer_post.record.initial'),
                      element('Container', {
                        className: 'stack',
                        children: [
                          bound('Text', 'apiContainer_post.record.author', 'bylineName'),
                          // The date and the reading time. The author is the line above it — a byline that repeats
                          // the name is what you get for binding the composed field twice.
                          bound('Text', 'apiContainer_post.record.dateline', 'meta')
                        ]
                      })
                    ]
                  }),
                  image('apiContainer_post.record.cover', 'articleImage'),
                  /**
                   * `richText` and not `blockHtml`: the second executes what it is given on purpose, which is right
                   * for an embed the site's own author pasted in and wrong for a body that came out of a store.
                   */
                  element('RichText', {
                    attributes: { format: 'markdown', content: '' },
                    className: 'prose',
                    bindings: [{ to: 'content', source: 'apiContainer_post.record.body' }]
                  }),
                  element('Container', {
                    className: 'authorBox',
                    children: [
                      avatar('apiContainer_post.record.initial'),
                      element('Container', {
                        className: 'stack',
                        children: [
                          bound('Text', 'apiContainer_post.record.author', 'bylineName'),
                          bound('Text', 'apiContainer_post.record.authorRole', 'meta'),
                          note('Writes here about what it takes to put a page together.')
                        ]
                      })
                    ]
                  })
                ]
              }),
              element('Container', {
                className: 'article',
                bindings: [shownWhen('apiContainer_post.found')],
                children: [
                  text('Keep reading', 'sectionLabel'),
                  element('List', {
                    idRef: 'moreList',
                    attributes: { source: 'controlled' },
                    className: 'moreGrid',
                    bindings: [{ to: 'items', source: 'apiContainer_post.more' }],
                    children: [
                      boundLink('list_moreList.item.url', 'moreCard', [
                        image('list_moreList.item.cover', 'moreImage'),
                        bound('Text', 'list_moreList.item.topic', 'chip'),
                        heading('list_moreList.item.title', 'moreTitle', 'h3'),
                        bound('Text', 'list_moreList.item.date', 'meta')
                      ])
                    ]
                  })
                ]
              }),
              element('Container', {
                className: 'centred',
                bindings: [shownWhen('apiContainer_post.missing')],
                children: [
                  element('Heading', {
                    attributes: { subType: 'h1', content: 'That post does not exist.' },
                    className: 'articleTitle'
                  }),
                  note('The link may be old, or the post may never have been published.'),
                  link('/', 'buttonQuiet', [label('Back to the latest')])
                ]
              })
            ]
          })
        ]
      })
    ])
  ]
};

/**
 * A form control is made of parts — a wrapper, a label, the input, an error — and `slots` is how a class reaches
 * one that is not the wrapper. Dressing it through `className` alone paints the box around the input instead.
 */
const field = (
  name: string,
  labelText: string,
  subType: string,
  extra: Record<string, unknown> = {},
  input = 'input'
): ElementSpec =>
  element('FormControl', {
    attributes: { name, label: labelText, subType, required: true, ...extra },
    className: 'fieldRow',
    slots: { input, label: 'fieldLabel' }
  });

/**
 * Write.
 *
 * `authenticated`, so the router only offers it to a visitor with a session — and that is a convenience, not the
 * control: the action's own trigger asks for `postPublish` before it runs a step, which is why `grace` can open
 * this page and still not publish.
 */
const write: PageSpec = {
  name: 'Write',
  slug: 'write',
  idRef: 'writePage',
  accessLevel: 'authenticated',
  // A visitor with no session lands on the sign-in rather than on a 403, which is the whole of "you must be
  // logged in to post" — stated on the page, not written into a guard somewhere.
  unauthorizedRedirect: 'login',
  className: 'page',
  body: [
    chrome('chromeWrite', [
      element('Container', {
        className: 'main',
        children: [
          element('Container', {
            className: 'editor',
            children: [
              element('Container', {
                className: 'form',
                children: [
                  element('Heading', { attributes: { subType: 'h1', content: 'New post' }, className: 'articleTitle' }),
                  element('Form', {
                    idRef: 'postForm',
                    className: 'form',
                    // Without this the browser submits the form itself and the page navigates away; the flow runs.
                    attributes: { managedByInteractions: true, method: 'post' },
                    flows: [
                      [
                        { id: 'submitted', type: 'trigger', action: 'onSubmit', on: 'postForm' },
                        {
                          /**
                           * Named, because the two steps after it read what it answered. The flow's scope is keyed by
                           * step id, so `{{publish.output.url}}` resolves only because this step is `publish`.
                           *
                           * `runServerAction` is a GLOBAL callback: it names the module that registered it, not an
                           * element. The page hands over an action name and four values — never a URL, never a
                           * credential, never a table.
                           */
                          id: 'publish',
                          type: 'globalCallback',
                          action: 'runServerAction',
                          on: 'actions',
                          params: {
                            actionId: 'publish-post',
                            input:
                              '{"title":"{{submitted.values.title}}","standfirst":"{{submitted.values.standfirst}}","topic":"{{submitted.values.topic}}","body":"{{submitted.values.body}}"}',
                            // `await`, so the steps below have a result to read. `detached` would carry on at once.
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
                          when: {
                            combinator: 'and',
                            rules: [{ field: 'publish.status', operator: '!=', value: 'completed' }]
                          }
                        },
                        {
                          id: 'published',
                          type: 'globalCallback',
                          action: 'navigate',
                          on: 'navigation',
                          // The post it just wrote, addressed by what the action answered. The page it lands on
                          // resolves its own section on the way in, so this is an ordinary route change.
                          params: { urlType: 'internal', url: '{{publish.output.url}}' },
                          when: {
                            combinator: 'and',
                            rules: [{ field: 'publish.status', operator: '=', value: 'completed' }]
                          }
                        }
                      ]
                    ],
                    children: [
                      field('title', 'Title', 'text', { placeholder: 'Something worth the front page' }),
                      field('standfirst', 'Standfirst', 'text', {
                        placeholder: 'One line under the headline',
                        required: false
                      }),
                      field('topic', 'Topic', 'text', { defaultValue: 'Notes', required: false }),
                      field('body', 'Body', 'textarea', { placeholder: '## Markdown is fine' }, 'textarea'),
                      element('Button', { attributes: { subType: 'submit', content: 'Publish' }, className: 'button' })
                    ]
                  }),
                  element('Paragraph', {
                    attributes: { content: '' },
                    className: 'notice',
                    bindings: [{ to: 'content', source: 'state.notice' }]
                  })
                ]
              }),
              element('Container', {
                className: 'sidebar',
                children: [
                  panel('What happens on submit', [
                    note(
                      'The page sends an action name and four values. The server checks the permission on the trigger, runs the flow, and answers the URL of what it wrote — which is where you land.'
                    )
                  ]),
                  panel('The author is the session', [
                    note(
                      'There is no author field here and none in the action’s input contract, so there is nothing for a caller to put somebody else’s name in.'
                    )
                  ])
                ]
              })
            ]
          })
        ]
      })
    ])
  ]
};

/**
 * Sign in, and the account — TWO pages on ONE path.
 *
 * `public` does not mean "for everybody": it means signed-out visitors, and it is one half of a pair. The router
 * picks between them from whether there is a session, so neither page contains a condition.
 */
const signIn: PageSpec = {
  name: 'Sign in',
  slug: 'login',
  idRef: 'signInPage',
  accessLevel: 'public',
  className: 'page',
  body: [
    chrome('chromeLogin', [
      element('Container', {
        className: 'main',
        children: [
          element('Container', {
            className: 'centred',
            children: [
              element('Container', {
                className: 'cardSurface',
                children: [
                  element('Heading', { attributes: { subType: 'h1', content: 'Sign in' }, className: 'formTitle' }),
                  note('ada / password writes posts. grace / password may only read them — and is refused, politely.'),
                  element('Form', {
                    idRef: 'loginForm',
                    className: 'form',
                    attributes: { managedByInteractions: true, method: 'post' },
                    flows: [
                      [
                        { id: 'signIn', type: 'trigger', action: 'onSubmit', on: 'loginForm' },
                        {
                          // `login` is the name the callback is REGISTERED under, on the module `auth` — not the label
                          // the builder shows for it. A name that resolves to nothing fails the step in silence.
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
                      element('Button', {
                        attributes: { subType: 'submit', content: 'Sign in' },
                        className: 'buttonWide'
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      })
    ])
  ]
};

const account: PageSpec = {
  name: 'Account',
  slug: 'login',
  idRef: 'accountPage',
  accessLevel: 'authenticated',
  className: 'page',
  body: [
    chrome('chromeAccount', [
      element('Container', {
        className: 'main',
        children: [
          element('Container', {
            className: 'centred',
            children: [
              element('Container', {
                className: 'cardSurface',
                children: [
                  element('Container', {
                    className: 'metaRow',
                    children: [
                      /**
                       * The initial comes from the page's own chrome provider: the whole page sits inside it, and
                       * a source reaches every element below the provider that publishes it.
                       */
                      avatar('apiContainer_chromeAccount.initial'),
                      element('Container', {
                        className: 'stack',
                        children: [
                          /**
                           * `auth` is the source the SDK publishes from whoever is signed in. On a server-rendered
                           * page it is already filled in when the HTML leaves the server — the name is in the
                           * markup, not painted in after.
                           */
                          bound('Text', 'auth.details.username', 'bylineName'),
                          bound('Text', 'auth.details.email', 'meta')
                        ]
                      })
                    ]
                  }),
                  element('Container', {
                    className: 'chipRow',
                    children: [
                      element('Text', {
                        attributes: { content: 'May publish' },
                        className: 'chip',
                        bindings: [shownWhen('apiContainer_chromeAccount.canWrite')]
                      }),
                      element('Text', {
                        attributes: { content: 'Reader' },
                        className: 'chipQuiet',
                        bindings: [shownWhen('apiContainer_chromeAccount.readOnly')]
                      })
                    ]
                  }),
                  note('Signed in. The header above already knows it, because the server told it so.'),
                  element('Container', {
                    className: 'actionRow',
                    children: [
                      writeLink('chromeAccount'),
                      element('Button', {
                        idRef: 'signOut',
                        attributes: { subType: 'button', content: 'Sign out' },
                        className: 'buttonQuiet',
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
              })
            ]
          })
        ]
      })
    ])
  ]
};

const blog: SpaceSpec = {
  name: 'The Plitzi Post',
  permanentUrl: 'blog',
  variables,
  elements,
  classes,
  customCss,
  /**
   * The switch that makes the providers server-side. Without it their elements fall back to mock data and nothing
   * anywhere reports a missing setting.
   */
  rsc: { enabled: true },
  /**
   * What the browser half of auth needs: which provider, and the four endpoints it calls. `sessionHintCookie` is a
   * readable cookie carrying only expiry timestamps, so a page can tell that nobody is signed in — the common
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
