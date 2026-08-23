import {
  apiContainer,
  authLogin,
  authLogout,
  authorSpace,
  button,
  container,
  defineElement,
  element,
  form,
  formControl,
  heading,
  hiddenWhen,
  image,
  link,
  list,
  named,
  navigate,
  on,
  onClick,
  onSubmit,
  pagination,
  paragraph,
  richText,
  runServerAction,
  setState,
  text,
  themeToggle,
  visibleWhen,
  whenFailed,
  whenSucceeded
} from '@plitzi/sdk-server/authoring';

import { classes, customCss, elements, variables } from './theme';

import type { Attributes, ElementSpec, PageSpec, SpaceSpec } from '@plitzi/sdk-server/authoring';
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

const bound = (type: 'text' | 'paragraph', source: string, className: string): ElementSpec =>
  element(type, { content: '', class: className, bind: [{ to: 'content', source }] });

const boundHeading = (source: string, className: string, subType: Attributes<'heading'>['subType'] = 'h2'): ElementSpec =>
  heading({ subType, content: '', class: className, bind: [{ to: 'content', source }] });

const boundImage = (source: string, className: string): ElementSpec =>
  image({ alt: '', loadMode: 'lazy', class: className, bind: [{ to: 'src', source }] });

/** `internal` is a path this space serves; `page` would resolve a page id instead, and `external` leaves. */
const linkTo = (href: string, className: string, children: ElementSpec[]): ElementSpec =>
  link({ href, mode: 'internal', class: className, children });

/**
 * The text inside a pill, button or link.
 *
 * One class for all of them, and the reason is worth stating: the box — the border, the padding, the radius —
 * belongs to the link, and giving the text the link's class draws the box a second time INSIDE the first. This
 * one carries no type of its own; it inherits every bit of it from whatever it sits in.
 */
const label = (content: string): ElementSpec => text({ content, class: 'inlineLabel' });

/**
 * The element this space ships itself, with a factory as typed as any built-in one.
 *
 * `defineElement` takes a declaration rather than a name, which is the whole of what a custom type needs: the
 * SDK's catalogue has no `speciesStatus` in it and does not have to — the server was handed the component in
 * `main.ts` and the page names the same type here. The attributes are declared once, above, and from then on a
 * misspelt one is a compile error rather than a panel that renders blank.
 */
type SpeciesAttributes = {
  name?: string;
  latin?: string;
  status?: string;
  trend?: string;
  history?: string;
  since?: string;
  note?: string;
};

const speciesStatus = defineElement<SpeciesAttributes>({
  type: 'speciesStatus',
  content: { definition: { label: 'Species Status' } }
});

const speciesPanel = (src: string): ElementSpec =>
  speciesStatus({
      class: 'speciesPanel',
      bind: [
        { to: 'name', source: `${src}.species.name` },
        { to: 'latin', source: `${src}.species.latin` },
        { to: 'status', source: `${src}.species.status` },
        { to: 'trend', source: `${src}.species.trend` },
        { to: 'history', source: `${src}.species.history` },
        { to: 'since', source: `${src}.species.since` },
        { to: 'note', source: `${src}.species.note` },
        // An article about a place rather than an animal simply does not draw one.
        visibleWhen(`${src}.hasSpecies`)
      ]
  });

/** A link whose destination is a field — a card, a headline, an item in a list of recent posts. */
const boundLink = (source: string, className: string, children: ElementSpec[]): ElementSpec =>
  link({ mode: 'internal', class: className, bind: [{ to: 'href', source }], children });

/** An initial in a circle: no image to load, nothing to go missing, and it works for any name. */
const avatar = (source: string, className = 'avatar'): ElementSpec =>
  text({ content: '', class: className, bind: [{ to: 'content', source }] });

/** Author, date and reading time in one line — composed on the server, because a binding names one field. */
const byline = (src: string): ElementSpec =>
  container({
    class: 'metaRow',
    children: [avatar(`${src}.initial`, 'avatarSm'), bound('text', `${src}.byline`, 'meta')]
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

  return apiContainer({
    idRef: ref,
    runtime: 'server',
    action: 'site-chrome',
    class: 'pageInner',
    children: [
      container({
        class: 'headerBand',
        children: [
          container({
            class: 'headerInner',
            children: [
              linkTo('/', 'brand', [
                text('F', { class: 'brandMark' }),
                container({
                  class: 'stack',
                  children: [text('Fieldnotes', { class: 'brandName' }), text('Wildlife, close up', { class: 'brandTag' })]
                })
              ]),
              container({
                class: 'nav',
                children: [
                  linkTo('/', 'navLink', [label('Latest')]),
                  // Hidden unless the session holds `postPublish` — a dead end is bad manners, and that is all
                  // this is: the action behind the link refuses the same people either way.
                  link({
                    href: '/write', mode: 'internal',
                    class: 'navLink',
                    bind: [visibleWhen(`${src}.canWrite`)],
                    children: [label('Write')]
                  }),
                  /**
                   * Light and dark, as a control rather than as a setting of the visitor's machine.
                   *
                   * The element ships two icons and no colours: it writes the choice on the document root, and
                   * this space's palette — every colour here is a variable with a value per scheme — follows it.
                   * Which icon shows is a rule in `theme.ts`, answered the same way the palette is.
                   */
                  themeToggle({
                    idRef: `${ref}Theme`,
                    subType: 'switch', lightLabel: 'Light', darkLabel: 'Dark',
                    class: 'themeToggle'
                  }),
                  /**
                   * Two controls, not one that changes its mind.
                   *
                   * A signed-out visitor gets an invitation and a signed-in one gets their own name — different
                   * shapes, so neither is a compromise between the two. Each binds its visibility to a fact the
                   * server answered, which is how a page says "either/or" without a condition in it.
                   */
                  link({
                    href: '/login', mode: 'internal',
                    class: 'signInLink',
                    bind: [hiddenWhen(`${src}.signedIn`)],
                    children: [label('Sign in')]
                  }),
                  link({
                    href: '/login', mode: 'internal',
                    class: 'accountPill',
                    bind: [visibleWhen(`${src}.signedIn`)],
                    children: [avatar(`${src}.initial`, 'avatarSm'), bound('text', `${src}.accountLabel`, 'bylineName')]
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
  link({
    href: '/write', mode: 'internal',
    class: 'chipQuiet',
    bind: [visibleWhen(`apiContainer_${ref}.canWrite`)],
    children: [label('Write a post')]
  });

const footer = (): ElementSpec =>
  container({
    class: 'footerBand',
    children: [
      container({
        class: 'footerInner',
        children: [
          container({
            class: 'brand',
            children: [
              text('F', { class: 'brandMark' }),
              container({
                class: 'stack',
                children: [
                  text('Fieldnotes', { class: 'brandName' }),
                  text('Seven animals, and what is actually known about them.', { class: 'meta' })
                ]
              })
            ]
          }),
          container({
            class: 'footerEnd',
            children: [
              text('Built with Plitzi', { class: 'footerLabel' }),
              text(
                'Every page here is a layout, every read is a flow the server runs, and no page has a build step.',
                { class: 'meta' }
                )
            ]
          })
        ]
      })
    ]
  });

/** One story in the main column: cover, topic, headline, excerpt, byline. */
const feedCard = (src: string): ElementSpec =>
  container({
    class: 'card',
    children: [
      boundLink(`${src}.url`, 'cardLink', [boundImage(`${src}.cover`, 'cardImage')]),
      container({
        class: 'cardBody',
        children: [
          bound('text', `${src}.topic`, 'chip'),
          boundLink(`${src}.url`, 'cardLink', [boundHeading(`${src}.title`, 'cardTitle')]),
          bound('paragraph', `${src}.excerpt`, 'cardExcerpt'),
          byline(src)
        ]
      })
    ]
  });

const panel = (title: string, children: ElementSpec[]): ElementSpec =>
  container({
    class: 'panel',
    children: [
      heading({ subType: 'h3', content: title, class: 'panelTitle' }),
      ...children
    ]
  });

const note = (content: string): ElementSpec =>
  paragraph({ content, class: 'panelText' });

const home: PageSpec = {
  name: 'Latest posts',
  slug: '',
  idRef: 'home',
  seoTitle: 'Fieldnotes — wildlife, close up',
  seoDescription: 'A wildlife magazine, rendered by Plitzi: posts, sessions and who may publish.',
  class: 'page',
  body: [
    chrome('chromeHome', [
      container({
        class: 'main',
        children: [
          /**
           * Everything on this page comes out of one provider.
           *
           * It names an ACTION and renders on the server (`runtime: 'server'`), so the records are in the HTML the
           * first request answers. `pagination: 'url'` and the pager below name the same query parameter, and the
           * action reads it as its input — which is the whole of wiring the two together.
           */
          apiContainer({
            idRef: 'posts',
            runtime: 'server',
            action: 'list-posts',
              // What this element asks of the action, on top of the page's own route and query params.
              input: { perPage: 4, featured: true },
              pagination: 'url',
              pageParam: 'page',
            class: 'pageStack',
            children: [
              /**
               * The lead story: one photograph, with the headline living inside it.
               *
               * The whole card is ONE link — the picture and the words are the same click, which is what a reader
               * expects of a cover and what saves the page a second `boundLink` around the title. The layer of
               * text sits over the image because `heroScrim` is positioned over it, and it carries the gradient
               * that keeps a white headline readable on a photograph the layout has never seen.
               */
              link({
                mode: 'internal',
                class: 'hero',
                bind: [
                  { to: 'href', source: 'apiContainer_posts.featured.url' },
                  // Without this the link is announced as every word inside the card — topic, headline,
                  // standfirst, byline and button, in one breath. `label` is what it says instead.
                  { to: 'label', source: 'apiContainer_posts.featured.title' },
                  visibleWhen('apiContainer_posts.hasFeatured')
                ],
                children: [
                  boundImage('apiContainer_posts.featured.cover', 'heroImage'),
                  container({
                    class: 'heroScrim',
                    children: [
                      bound('text', 'apiContainer_posts.featured.topic', 'chipOnPhoto'),
                      boundHeading('apiContainer_posts.featured.title', 'heroTitle', 'h1'),
                      bound('paragraph', 'apiContainer_posts.featured.standfirst', 'heroStandfirst'),
                      container({
                        class: 'metaRow',
                        children: [
                          avatar('apiContainer_posts.featured.initial', 'avatarSm'),
                          bound('text', 'apiContainer_posts.featured.byline', 'metaOnPhoto')
                        ]
                      }),
                      container({ class: 'readLink', children: [label('Read the story')] })
                    ]
                  })
                ]
              }),
              container({
                class: 'layout',
                children: [
                  container({
                    class: 'feed',
                    children: [
                      text({
                        content: 'More stories',
                        class: 'sectionLabel',
                        bind: [hiddenWhen('apiContainer_posts.filtered')]
                      }),
                      // The same slot, saying what the list was narrowed to. Two elements, one field, no branch.
                      text({
                        content: '',
                        class: 'sectionLabel',
                        bind: [
                          { to: 'content', source: 'apiContainer_posts.filterLabel' },
                          visibleWhen('apiContainer_posts.filtered')
                        ]
                      }),
                      /**
                       * The list renders its one child once per record, each row under its own scope — which is what
                       * `list_postList.item` is. One template, however many posts.
                       */
                      list({
                        idRef: 'postList',
                        source: 'controlled',
                        class: 'feed',
                        bind: [{ to: 'items', source: 'apiContainer_posts.records' }],
                        children: [feedCard('list_postList.item')]
                      }),
                      /**
                       * The pager reads the provider's own `pageInfo` and nothing else, so it never talks to it: in
                       * URL mode it writes the page into the address bar and the server resolves the window that URL
                       * asks for — which keeps the result shareable, indexable and back-button-proof.
                       */
                      pagination({
                        idRef: 'postPager',
                        mode: 'pages', target: 'url', pageParam: 'page',
                        class: 'pager',
                        bind: [{ to: 'pageInfo', source: 'apiContainer_posts.pageInfo' }]
                      })
                    ]
                  }),
                  container({
                    class: 'sidebar',
                    children: [
                      panel('About', [
                        note(
                          'A field magazine about animals, and a demonstration of Plitzi: every page here is a layout, every read is a flow the server runs, and publishing is a permission rather than a button.'
                        ),
                        writeLink('chromeHome')
                      ]),
                      /**
                       * A second provider, nested inside the first, asking the SAME action a different question:
                       * five posts, no lead story, always the first window. An element declares what it wants and the
                       * action answers it — there is no second endpoint here, and no second task.
                       */
                      apiContainer({
                        idRef: 'recent',
                        runtime: 'server',
                        // `topic: ''` is not noise: a render trigger's input is the page's own query params plus
                        // whatever the element declares, so without saying so this provider would be filtered by
                        // the URL too — and "From the archive" would only ever show the topic you are already in.
                        action: 'list-posts',
                          input: { page: 1, perPage: 5, featured: false, topic: '' },
                        class: 'sidebar',
                        children: [
                          panel('Topics', [
                            list({
                              idRef: 'topicList',
                              source: 'controlled',
                              class: 'chipRow',
                              /**
                               * The MAIN provider's topics, not the sidebar's — it is the one that was told what
                               * the URL asked for, so it is the one that knows which chip is chosen.
                               */
                              bind: [{ to: 'items', source: 'apiContainer_posts.topics' }],
                              /**
                               * Two chips per topic, and the binding picks.
                               *
                               * "Selected" is a different shape rather than a tint on the same one, and the style
                               * vocabulary has no way to swap a class from data anyway — so the list authors both
                               * and each binds its visibility to a field the server answered. The same either/or
                               * the header uses for signed in and signed out.
                               */
                              children: [
                                link({
                                  mode: 'internal',
                                  class: 'chipActive',
                                  bind: [
                                    { to: 'href', source: 'list_topicList.item.url' },
                                    visibleWhen('list_topicList.item.isActive')
                                  ],
                                  children: [bound('text', 'list_topicList.item.name', 'inlineLabel')]
                                }),
                                link({
                                  mode: 'internal',
                                  class: 'chipQuiet',
                                  bind: [
                                    { to: 'href', source: 'list_topicList.item.url' },
                                    hiddenWhen('list_topicList.item.isActive')
                                  ],
                                  children: [bound('text', 'list_topicList.item.name', 'inlineLabel')]
                                })
                              ]
                            })
                          ]),
                          panel('From the archive', [
                            list({
                              idRef: 'recentList',
                              source: 'controlled',
                              class: 'quietList',
                              bind: [{ to: 'items', source: 'apiContainer_recent.records' }],
                              children: [
                                boundLink('list_recentList.item.url', 'quietItem', [
                                  bound('text', 'list_recentList.item.title', 'quietTitle'),
                                  bound('text', 'list_recentList.item.date', 'meta')
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
              paragraph({
                content: 'No posts yet. Sign in as ada and write the first one.',
                class: 'panelText',
                bind: [visibleWhen('apiContainer_posts.isEmpty')]
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
  class: 'page',
  /**
   * The one thing this page asks about the READER rather than about the post.
   *
   * It is a page flow and not part of `get-post` because the two are answered differently: the post is built into
   * the page and shared between everyone reading it, while "have you already counted?" is true of one visitor and
   * false of the next. A `call` is per request and never cached, so this is the honest way to ask it — at the
   * price of one small request once the page is up, which is why nothing else on the page is asked this way.
   *
   * `{{slug}}` is the route param, and this fires again on every page change — so walking from a post you have
   * counted to one you have not answers the new question rather than carrying the old answer over.
   */
  flows: [
    [
      // A trigger says nothing about where it runs: it fires on whatever declared the flow, and this one is the page.
      named('entered', on('onPageLoad')),
      named('seen', runServerAction({ actionId: 'has-seen-sighting', input: { slug: '{{slug}}' } })),
      named('mark', setState({ key: 'sightingDone', type: 'boolean', value: '{{seen.output.hasSeen}}' }))
    ]
  ],
  body: [
    chrome('chromePost', [
      container({
        class: 'main',
        children: [
          apiContainer({
            idRef: 'post',
            runtime: 'server',
            action: 'get-post', singleRecord: true, subType: 'main',
            class: 'pageStack',
            children: [
              container({
                class: 'article',
                // Two halves of one answer, each bound to a flag the action returned. A page for a slug nobody wrote
                // has to say so, and saying so is a binding rather than a branch.
                bind: [visibleWhen('apiContainer_post.found')],
                children: [
                  bound('text', 'apiContainer_post.record.topic', 'chip'),
                  boundHeading('apiContainer_post.record.title', 'articleTitle', 'h1'),
                  bound('paragraph', 'apiContainer_post.record.standfirst', 'articleStandfirst'),
                  container({
                    class: 'bylineRow',
                    children: [
                      container({
                        class: 'metaRow',
                        children: [
                          avatar('apiContainer_post.record.initial'),
                          container({
                            class: 'stack',
                            children: [
                              bound('text', 'apiContainer_post.record.author', 'bylineName'),
                              // The date and the reading time. The author is the line above it — a byline that
                              // repeats the name is what you get for binding the composed field twice.
                              bound('text', 'apiContainer_post.record.dateline', 'meta'),
                              // Only on a post somebody went back to. A blog that edits silently is a blog you
                              // cannot trust twice.
                              bound('text', 'apiContainer_post.record.updated', 'metaEdited')
                            ]
                          })
                        ]
                      }),
                      /**
                       * "Edit", and only for the person who wrote this one.
                       *
                       * `canEdit` is not the permission: `ada` holds `postPublish` and still may not rewrite
                       * `grace`'s post. The action's trigger cannot decide that — at the moment it runs there is
                       * no record — so the task answered it, and the link binds to what the task said.
                       */
                      link({
                        mode: 'internal',
                        class: 'chipQuiet',
                        bind: [
                          { to: 'href', source: 'apiContainer_post.editUrl' },
                          visibleWhen('apiContainer_post.canEdit')
                        ],
                        children: [label('Edit this post')]
                      })
                    ]
                  }),
                  boundImage('apiContainer_post.record.cover', 'articleImage'),
                  speciesPanel('apiContainer_post.record'),
                  /**
                   * `richText` and not `blockHtml`: the second executes what it is given on purpose, which is right
                   * for an embed the site's own author pasted in and wrong for a body that came out of a store.
                   */
                  richText({
                    format: 'markdown', content: '',
                    class: 'prose',
                    bind: [{ to: 'content', source: 'apiContainer_post.record.body' }]
                  }),
                  /**
                   * The one write on this blog anybody may make — no session, no permission, no account.
                   *
                   * Worth putting on the page for more than charm: it is the button to press with the dev-tools
                   * **Actions** tab open. The three reads that build these pages are `render` triggers resolved
                   * on the server, so the browser never started them and a browser-side panel has nothing to
                   * show. This one the page starts, and every press is a run with an input, an output and a
                   * duration.
                   */
                  container({
                    class: 'sightingBox',
                    children: [
                      container({
                        class: 'stack',
                        children: [
                          text('Seen one yourself?', { class: 'bylineName' }),
                          bound('text', 'apiContainer_post.record.sightings', 'meta')
                        ]
                      }),
                      button({
                        idRef: 'sighting',
                        subType: 'button', content: 'I have seen one',
                        class: 'buttonQuiet',
                        /**
                         * Off once this reader has counted.
                         *
                         * The page's half of "once each", and only its half: the state is this tab's, so a reload
                         * brings the button back. What actually holds is `blog.recordSighting`, which remembers
                         * who has already counted and answers the second press with the total rather than adding
                         * to it — a rule about other readers is not something a browser can be asked to keep.
                         */
                        bind: [{ to: 'disabled', source: 'state.sightingDone' }],
                        flows: [
                          [
                            named('seen', onClick()),
                            named(
                              'log',
                              runServerAction({
                                actionId: 'record-sighting',
                                // The slug the page was built for. The action checks it names a real post —
                                // otherwise it opens a counter for anything a caller cares to type.
                                input: { slug: '{{apiContainer_post.record.slug}}' }
                              })
                            ),
                            // What the SERVER counted, not what the page guessed. A count incremented in the
                            // browser is a count that disagrees with the next reader's.
                            named('thanks', setState({ key: 'sighting', type: 'text', value: '{{log.output.message}}' })),
                            named('counted', setState({ key: 'sightingDone', type: 'boolean', value: 'true' }))
                          ]
                        ]
                      }),
                      paragraph({
                        content: '',
                        class: 'notice',
                        bind: [{ to: 'content', source: 'state.sighting' }]
                      })
                    ]
                  }),
                  container({
                    class: 'authorBox',
                    children: [
                      avatar('apiContainer_post.record.initial'),
                      container({
                        class: 'stack',
                        children: [
                          bound('text', 'apiContainer_post.record.author', 'bylineName'),
                          bound('text', 'apiContainer_post.record.authorRole', 'meta'),
                          note('Writes here about animals, and about the people who go out and count them.')
                        ]
                      })
                    ]
                  })
                ]
              }),
              container({
                class: 'article',
                bind: [visibleWhen('apiContainer_post.found')],
                children: [
                  text('Keep reading', { class: 'sectionLabel' }),
                  list({
                    idRef: 'moreList',
                    source: 'controlled',
                    class: 'moreGrid',
                    bind: [{ to: 'items', source: 'apiContainer_post.more' }],
                    children: [
                      boundLink('list_moreList.item.url', 'moreCard', [
                        boundImage('list_moreList.item.cover', 'moreImage'),
                        bound('text', 'list_moreList.item.topic', 'chip'),
                        boundHeading('list_moreList.item.title', 'moreTitle', 'h3'),
                        bound('text', 'list_moreList.item.date', 'meta')
                      ])
                    ]
                  })
                ]
              }),
              container({
                class: 'centred',
                bind: [hiddenWhen('apiContainer_post.found')],
                children: [
                  heading({
                    subType: 'h1', content: 'That post does not exist.',
                    class: 'articleTitle'
                  }),
                  note('The link may be old, or the post may never have been published.'),
                  linkTo('/', 'buttonQuiet', [label('Back to the latest')])
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
  subType: Attributes<'formControl'>['subType'],
  extra: Record<string, unknown> = {},
  input = 'input'
): ElementSpec =>
  formControl({
    name, label: labelText, subType, required: true, ...extra,
    class: 'fieldRow',
    slots: { input, label: 'fieldLabel' }
  });

/**
 * The same control, starting from what the server already knows.
 *
 * An editor is a form with the record poured into it, and `defaultValue` is where the record goes — bound, like
 * any other attribute. On a server-rendered page the value is in the markup before the browser has done anything,
 * which is why the editor never flashes empty and then fills itself in.
 */
const boundField = (
  name: string,
  labelText: string,
  subType: Attributes<'formControl'>['subType'],
  source: string,
  extra: Record<string, unknown> = {},
  input = 'input'
): ElementSpec =>
  formControl({
    name, label: labelText, subType, required: true, defaultValue: '', ...extra,
    class: 'fieldRow',
    slots: { input, label: 'fieldLabel' },
    bind: [{ to: 'defaultValue', source }]
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
  class: 'page',
  body: [
    chrome('chromeWrite', [
      container({
        class: 'main',
        children: [
          container({
            class: 'editor',
            children: [
              container({
                class: 'form',
                children: [
                  heading({ subType: 'h1', content: 'New post', class: 'articleTitle' }),
                  form({
                    idRef: 'postForm',
                    class: 'form',
                    // Without this the browser submits the form itself and the page navigates away; the flow runs.
                    managedByInteractions: true, method: 'post',
                    flows: [
                      [
                        named('submitted', onSubmit()),
                        /**
                         * Named, because the two steps after it read what it answered. The flow's scope is keyed by
                         * step id, so `{{publish.output.url}}` resolves only because this step is `publish`.
                         *
                         * `runServerAction` is a GLOBAL callback: it names the module that registered it, not an
                         * element — which is what its builder fills in, along with `mode: 'await'`, without which
                         * the steps below would have no result to read. The page hands over an action name and five
                         * values, never a URL, a credential or a table.
                         *
                         * `input` as an OBJECT, one token per field — not as a line of JSON text with tokens
                         * interpolated into it. A post body has newlines and quotation marks in it, and dropping
                         * those into a JSON string literal produces text that does not parse, which posts nothing
                         * at all rather than refusing.
                         */
                        named(
                          'publish',
                          runServerAction({
                            actionId: 'publish-post',
                            input: {
                              title: '{{submitted.values.title}}',
                              standfirst: '{{submitted.values.standfirst}}',
                              topic: '{{submitted.values.topic}}',
                              cover: '{{submitted.values.cover}}',
                              body: '{{submitted.values.body}}'
                            }
                          })
                        ),
                        // The refusal the server decided, shown by the page rather than guessed at by it.
                        whenFailed(
                          'publish',
                          named(
                            'refused',
                            setState({
                              key: 'notice',
                              type: 'text',
                              value: 'The server refused this: {{publish.reason}}'
                            })
                          )
                        ),
                        // The post it just wrote, addressed by what the action answered. The page it lands on
                        // resolves its own section on the way in, so this is an ordinary route change.
                        whenSucceeded(
                          'publish',
                          named('published', navigate({ urlType: 'internal', url: '{{publish.output.url}}' }))
                        )
                      ]
                    ],
                    children: [
                      field('title', 'Title', 'text', { placeholder: 'Something worth the front page' }),
                      field('standfirst', 'Standfirst', 'text', {
                        placeholder: 'One line under the headline',
                        required: false
                      }),
                      field('topic', 'Topic', 'text', { defaultValue: 'Fieldnotes', required: false }),
                      /**
                       * The cover, as a URL — because that is all a cover ever is.
                       *
                       * No upload here, and it is not an omission: the field a media library fills in and the
                       * field you paste a link into are the SAME field. Leave it empty and the post gets a cover
                       * drawn from its own slug, so the front page never has a hole in it.
                       */
                      field('cover', 'Cover image URL', 'text', {
                        placeholder: 'https://images.unsplash.com/photo-… — or leave it empty',
                        required: false
                      }),
                      field('body', 'Body', 'textarea', { placeholder: '## Markdown is fine' }, 'textarea'),
                      button({ subType: 'submit', content: 'Publish', class: 'button' })
                    ]
                  }),
                  paragraph({
                    content: '',
                    class: 'notice',
                    bind: [{ to: 'content', source: 'state.notice' }]
                  })
                ]
              }),
              container({
                class: 'sidebar',
                children: [
                  panel('What happens on submit', [
                    note(
                      'The page sends an action name and five values. The server checks the permission on the trigger, runs the flow, and answers the URL of what it wrote — which is where you land.'
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
 * Edit.
 *
 * The counterpart to `/write`, and the page that shows what a permission alone cannot decide. It reads the post
 * with the SAME action the public page uses — one action, two pages, no second endpoint — and the answer already
 * carries `canEdit`, so the editor and the refusal are two halves bound to one field rather than a branch.
 *
 * The refusal on screen is a courtesy. `blog.updatePost` asks the ownership question again, with the record in
 * hand, and a caller who skips this page entirely gets the same no.
 */
const edit: PageSpec = {
  name: 'Edit',
  slug: 'edit/{{slug}}',
  idRef: 'editPage',
  accessLevel: 'authenticated',
  unauthorizedRedirect: 'login',
  class: 'page',
  body: [
    chrome('chromeEdit', [
      container({
        class: 'main',
        children: [
          apiContainer({
            idRef: 'editPost',
            runtime: 'server',
            action: 'get-post', singleRecord: true, subType: 'main',
            class: 'pageStack',
            children: [
              container({
                class: 'editor',
                bind: [visibleWhen('apiContainer_editPost.canEdit')],
                children: [
                  container({
                    class: 'form',
                    children: [
                      heading({
                        subType: 'h1', content: 'Edit post',
                        class: 'articleTitle'
                      }),
                      bound('paragraph', 'apiContainer_editPost.record.title', 'articleStandfirst'),
                      form({
                        idRef: 'editForm',
                        class: 'form',
                        managedByInteractions: true, method: 'post',
                        flows: [
                          [
                            named('edited', onSubmit()),
                            /**
                             * The same global callback the editor on `/write` uses, naming a different action. The
                             * page hands over a name and six values; which post is one of them, and WHO is not —
                             * the session answers that, on the server, where it cannot be edited.
                             */
                            named(
                              'save',
                              runServerAction({
                                actionId: 'update-post',
                                // An object, one token per field — see the note on `publish-post`. A body that
                                // came out of a store is exactly the text that breaks the JSON-in-a-string form.
                                input: {
                                  slug: '{{edited.values.slug}}',
                                  title: '{{edited.values.title}}',
                                  standfirst: '{{edited.values.standfirst}}',
                                  topic: '{{edited.values.topic}}',
                                  cover: '{{edited.values.cover}}',
                                  body: '{{edited.values.body}}'
                                }
                              })
                            ),
                            whenFailed(
                              'save',
                              named(
                                'refused',
                                setState({
                                  key: 'notice',
                                  type: 'text',
                                  value: 'The server refused this: {{save.reason}}'
                                })
                              )
                            ),
                            whenSucceeded(
                              'save',
                              named('saved', navigate({ urlType: 'internal', url: '{{save.output.url}}' }))
                            )
                          ]
                        ],
                        children: [
                          /**
                           * Which post this is, carried in a hidden field rather than read from the URL by the
                           * flow: a form submits VALUES, and the slug is one of them. It is also the only field
                           * the server does not take on trust — the store matches it against the session's own id
                           * before it changes a thing.
                           */
                          boundField('slug', '', 'hidden', 'apiContainer_editPost.record.slug'),
                          boundField('title', 'Title', 'text', 'apiContainer_editPost.record.title'),
                          boundField('standfirst', 'Standfirst', 'text', 'apiContainer_editPost.record.standfirst', {
                            required: false
                          }),
                          boundField('topic', 'Topic', 'text', 'apiContainer_editPost.record.topic', {
                            required: false
                          }),
                          boundField('cover', 'Cover image URL', 'text', 'apiContainer_editPost.record.cover', {
                            placeholder: 'Leave it as it is, or paste another',
                            required: false
                          }),
                          boundField('body', 'Body', 'textarea', 'apiContainer_editPost.record.body', {}, 'textarea'),
                          container({
                            class: 'actionRow',
                            children: [
                              button({
                                subType: 'submit', content: 'Save changes',
                                class: 'button'
                              }),
                              boundLink('apiContainer_editPost.record.url', 'buttonQuiet', [label('Cancel')])
                            ]
                          })
                        ]
                      }),
                      paragraph({
                        content: '',
                        class: 'notice',
                        bind: [{ to: 'content', source: 'state.notice' }]
                      })
                    ]
                  }),
                  container({
                    class: 'sidebar',
                    children: [
                      panel('A permission is not ownership', [
                        note(
                          'The trigger asks whether you may edit posts at all, once, before any step runs. Whether you may edit THIS one is a different question — there is no record yet when the trigger fires — so the task asks it, with the post in hand.'
                        )
                      ]),
                      panel('Blank means unchanged', [
                        note(
                          'Every field here arrives filled in by the server. Clear one and it is left alone rather than emptied, which is what makes an editor safe to open and close.'
                        )
                      ]),
                      speciesPanel('apiContainer_editPost.record')
                    ]
                  })
                ]
              }),
              container({
                class: 'centred',
                bind: [visibleWhen('apiContainer_editPost.cannotEdit')],
                children: [
                  container({
                    class: 'cardSurface',
                    children: [
                      heading({
                        subType: 'h1', content: 'Not yours to edit',
                        class: 'formTitle'
                      }),
                      note(
                        'You are signed in, and this post belongs to somebody else. The server would refuse the change too — this page is only saying so first.'
                      ),
                      boundLink('apiContainer_editPost.record.url', 'buttonQuiet', [label('Back to the post')])
                    ]
                  })
                ]
              }),
              container({
                class: 'centred',
                bind: [hiddenWhen('apiContainer_editPost.found')],
                children: [
                  container({
                    class: 'cardSurface',
                    children: [
                      heading({
                        subType: 'h1', content: 'That post does not exist.',
                        class: 'formTitle'
                      }),
                      linkTo('/', 'buttonQuiet', [label('Back to the latest')])
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
  class: 'page',
  body: [
    chrome('chromeLogin', [
      container({
        class: 'main',
        children: [
          container({
            class: 'centred',
            children: [
              container({
                class: 'cardSurface',
                children: [
                  heading({ subType: 'h1', content: 'Sign in', class: 'formTitle' }),
                  note(
                    'ada / password is on the masthead and may publish. grace / password reads — and is refused, politely, if she tries.'
                  ),
                  form({
                    idRef: 'loginForm',
                    class: 'form',
                    managedByInteractions: true, method: 'post',
                    flows: [
                      [
                        named('signIn', onSubmit()),
                        // Writes the action `login` on the module `auth` — the pair the runtime resolves a step by,
                        // and the one nobody should have to remember. A name that resolves to nothing does nothing.
                        authLogin({
                          mode: 'normal',
                          username: '{{signIn.values.username}}',
                          password: '{{signIn.values.password}}'
                        })
                      ]
                    ],
                    children: [
                      field('username', 'Username', 'text', { defaultValue: 'ada' }),
                      field('password', 'Password', 'password', { defaultValue: 'password' }),
                      button({
                        subType: 'submit', content: 'Sign in',
                        class: 'buttonWide'
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
  class: 'page',
  body: [
    chrome('chromeAccount', [
      container({
        class: 'main',
        children: [
          container({
            class: 'centred',
            children: [
              container({
                class: 'cardSurface',
                children: [
                  container({
                    class: 'metaRow',
                    children: [
                      /**
                       * The initial comes from the page's own chrome provider: the whole page sits inside it, and
                       * a source reaches every element below the provider that publishes it.
                       */
                      avatar('apiContainer_chromeAccount.initial'),
                      container({
                        class: 'stack',
                        children: [
                          /**
                           * `auth` is the source the SDK publishes from whoever is signed in. On a server-rendered
                           * page it is already filled in when the HTML leaves the server — the name is in the
                           * markup, not painted in after.
                           */
                          bound('text', 'auth.details.username', 'bylineName'),
                          bound('text', 'auth.details.email', 'meta')
                        ]
                      })
                    ]
                  }),
                  container({
                    class: 'chipRow',
                    children: [
                      text({
                        content: 'May publish',
                        class: 'chip',
                        bind: [visibleWhen('apiContainer_chromeAccount.canWrite')]
                      }),
                      text({
                        content: 'Reader',
                        class: 'chipQuiet',
                        bind: [visibleWhen('apiContainer_chromeAccount.readOnly')]
                      })
                    ]
                  }),
                  note('Signed in. The header above already knows it, because the server told it so.'),
                  container({
                    class: 'actionRow',
                    children: [
                      writeLink('chromeAccount'),
                      button({
                        idRef: 'signOut',
                        subType: 'button', content: 'Sign out',
                        class: 'buttonQuiet',
                        flows: [[named('signOut', onClick()), authLogout()]]
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
  name: 'Fieldnotes',
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
  pages: [home, post, write, edit, signIn, account]
};

export const offlineData = (): OfflineDataRaw => authorSpace(blog);
