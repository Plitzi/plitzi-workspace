import { element, elementSpec } from '@plitzi/sdk-elements/authoring';
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

/**
 * The element this space ships itself, authored exactly like a built-in one.
 *
 * `elementSpec` takes a declaration rather than a name, which is the whole of what a custom type needs: the SDK's
 * catalogue has no `speciesStatus` in it and does not have to — the server was handed the component in `main.ts`
 * and the page names the same type here. Every attribute is a binding onto the answer the post's own action
 * already returned, so the panel costs no request and no second source of truth.
 */
const speciesPanel = (src: string): ElementSpec =>
  elementSpec(
    { type: 'speciesStatus', content: { definition: { label: 'Species Status' } } },
    {
      className: 'speciesPanel',
      bindings: [
        { to: 'name', source: `${src}.species.name` },
        { to: 'latin', source: `${src}.species.latin` },
        { to: 'status', source: `${src}.species.status` },
        { to: 'trend', source: `${src}.species.trend` },
        { to: 'history', source: `${src}.species.history` },
        { to: 'since', source: `${src}.species.since` },
        { to: 'note', source: `${src}.species.note` },
        // An article about a place rather than an animal simply does not draw one.
        shownWhen(`${src}.hasSpecies`)
      ]
    }
  );

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
                text('F', 'brandMark'),
                element('Container', {
                  className: 'stack',
                  children: [text('Fieldnotes', 'brandName'), text('Wildlife, close up', 'brandTag')]
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
              text('F', 'brandMark'),
              element('Container', {
                className: 'stack',
                children: [
                  text('Fieldnotes', 'brandName'),
                  text('Seven animals, and what is actually known about them.', 'meta')
                ]
              })
            ]
          }),
          element('Container', {
            className: 'footerEnd',
            children: [
              text('Built with Plitzi', 'footerLabel'),
              text(
                'Every page here is a layout, every read is a flow the server runs, and no page has a build step.',
                'meta'
              )
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
  seoTitle: 'Fieldnotes — wildlife, close up',
  seoDescription: 'A wildlife magazine, rendered by Plitzi: posts, sessions and who may publish.',
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
              /**
               * The lead story: one photograph, with the headline living inside it.
               *
               * The whole card is ONE link — the picture and the words are the same click, which is what a reader
               * expects of a cover and what saves the page a second `boundLink` around the title. The layer of
               * text sits over the image because `heroScrim` is positioned over it, and it carries the gradient
               * that keeps a white headline readable on a photograph the layout has never seen.
               */
              element('Link', {
                attributes: { mode: 'internal' },
                className: 'hero',
                bindings: [
                  { to: 'href', source: 'apiContainer_posts.featured.url' },
                  // Without this the link is announced as every word inside the card — topic, headline,
                  // standfirst, byline and button, in one breath. `label` is what it says instead.
                  { to: 'label', source: 'apiContainer_posts.featured.title' },
                  shownWhen('apiContainer_posts.hasFeatured')
                ],
                children: [
                  image('apiContainer_posts.featured.cover', 'heroImage'),
                  element('Container', {
                    className: 'heroScrim',
                    children: [
                      bound('Text', 'apiContainer_posts.featured.topic', 'chipOnPhoto'),
                      heading('apiContainer_posts.featured.title', 'heroTitle', 'h1'),
                      bound('Paragraph', 'apiContainer_posts.featured.standfirst', 'heroStandfirst'),
                      element('Container', {
                        className: 'metaRow',
                        children: [
                          avatar('apiContainer_posts.featured.initial', 'avatarSm'),
                          bound('Text', 'apiContainer_posts.featured.byline', 'metaOnPhoto')
                        ]
                      }),
                      element('Container', { className: 'readLink', children: [label('Read the story')] })
                    ]
                  })
                ]
              }),
              element('Container', {
                className: 'layout',
                children: [
                  element('Container', {
                    className: 'feed',
                    children: [
                      element('Text', {
                        attributes: { content: 'More stories' },
                        className: 'sectionLabel',
                        bindings: [shownWhen('apiContainer_posts.unfiltered')]
                      }),
                      // The same slot, saying what the list was narrowed to. Two elements, one field, no branch.
                      element('Text', {
                        attributes: { content: '' },
                        className: 'sectionLabel',
                        bindings: [
                          { to: 'content', source: 'apiContainer_posts.filterLabel' },
                          shownWhen('apiContainer_posts.filtered')
                        ]
                      }),
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
                          'A field magazine about animals, and a demonstration of Plitzi: every page here is a layout, every read is a flow the server runs, and publishing is a permission rather than a button.'
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
                        // `topic: ''` is not noise: a render trigger's input is the page's own query params plus
                        // whatever the element declares, so without saying so this provider would be filtered by
                        // the URL too — and "From the archive" would only ever show the topic you are already in.
                        attributes: {
                          action: 'list-posts',
                          input: { page: 1, perPage: 5, featured: false, topic: '' }
                        },
                        className: 'sidebar',
                        children: [
                          panel('Topics', [
                            element('List', {
                              idRef: 'topicList',
                              attributes: { source: 'controlled' },
                              className: 'chipRow',
                              /**
                               * The MAIN provider's topics, not the sidebar's — it is the one that was told what
                               * the URL asked for, so it is the one that knows which chip is chosen.
                               */
                              bindings: [{ to: 'items', source: 'apiContainer_posts.topics' }],
                              /**
                               * Two chips per topic, and the binding picks.
                               *
                               * "Selected" is a different shape rather than a tint on the same one, and the style
                               * vocabulary has no way to swap a class from data anyway — so the list authors both
                               * and each binds its visibility to a field the server answered. The same either/or
                               * the header uses for signed in and signed out.
                               */
                              children: [
                                element('Link', {
                                  attributes: { mode: 'internal' },
                                  className: 'chipActive',
                                  bindings: [
                                    { to: 'href', source: 'list_topicList.item.url' },
                                    shownWhen('list_topicList.item.isActive')
                                  ],
                                  children: [bound('Text', 'list_topicList.item.name', 'inlineLabel')]
                                }),
                                element('Link', {
                                  attributes: { mode: 'internal' },
                                  className: 'chipQuiet',
                                  bindings: [
                                    { to: 'href', source: 'list_topicList.item.url' },
                                    shownWhen('list_topicList.item.isInactive')
                                  ],
                                  children: [bound('Text', 'list_topicList.item.name', 'inlineLabel')]
                                })
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
                    className: 'bylineRow',
                    children: [
                      element('Container', {
                        className: 'metaRow',
                        children: [
                          avatar('apiContainer_post.record.initial'),
                          element('Container', {
                            className: 'stack',
                            children: [
                              bound('Text', 'apiContainer_post.record.author', 'bylineName'),
                              // The date and the reading time. The author is the line above it — a byline that
                              // repeats the name is what you get for binding the composed field twice.
                              bound('Text', 'apiContainer_post.record.dateline', 'meta'),
                              // Only on a post somebody went back to. A blog that edits silently is a blog you
                              // cannot trust twice.
                              bound('Text', 'apiContainer_post.record.updated', 'metaEdited')
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
                      element('Link', {
                        attributes: { mode: 'internal' },
                        className: 'chipQuiet',
                        bindings: [
                          { to: 'href', source: 'apiContainer_post.editUrl' },
                          shownWhen('apiContainer_post.canEdit')
                        ],
                        children: [label('Edit this post')]
                      })
                    ]
                  }),
                  image('apiContainer_post.record.cover', 'articleImage'),
                  speciesPanel('apiContainer_post.record'),
                  /**
                   * `richText` and not `blockHtml`: the second executes what it is given on purpose, which is right
                   * for an embed the site's own author pasted in and wrong for a body that came out of a store.
                   */
                  element('RichText', {
                    attributes: { format: 'markdown', content: '' },
                    className: 'prose',
                    bindings: [{ to: 'content', source: 'apiContainer_post.record.body' }]
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
                  element('Container', {
                    className: 'sightingBox',
                    children: [
                      element('Container', {
                        className: 'stack',
                        children: [
                          text('Seen one yourself?', 'bylineName'),
                          bound('Text', 'apiContainer_post.record.sightings', 'meta')
                        ]
                      }),
                      element('Button', {
                        idRef: 'sighting',
                        attributes: { subType: 'button', content: 'I have seen one' },
                        className: 'buttonQuiet',
                        /**
                         * Off once this reader has counted.
                         *
                         * The page's half of "once each", and only its half: the state is this tab's, so a reload
                         * brings the button back. What actually holds is `blog.recordSighting`, which remembers
                         * who has already counted and answers the second press with the total rather than adding
                         * to it — a rule about other readers is not something a browser can be asked to keep.
                         */
                        bindings: [{ to: 'disabled', source: 'state.sightingDone' }],
                        flows: [
                          [
                            { id: 'seen', type: 'trigger', action: 'onClick', on: 'sighting' },
                            {
                              id: 'log',
                              type: 'globalCallback',
                              action: 'runServerAction',
                              on: 'actions',
                              params: {
                                actionId: 'record-sighting',
                                // The slug the page was built for. The action checks it names a real post —
                                // otherwise it opens a counter for anything a caller cares to type.
                                input: { slug: '{{apiContainer_post.record.slug}}' },
                                mode: 'await'
                              }
                            },
                            {
                              id: 'thanks',
                              type: 'globalCallback',
                              action: 'setState',
                              on: 'state',
                              // What the SERVER counted, not what the page guessed. A count incremented in the
                              // browser is a count that disagrees with the next reader's.
                              params: { key: 'sighting', type: 'text', value: '{{log.output.message}}' }
                            },
                            {
                              id: 'counted',
                              type: 'globalCallback',
                              action: 'setState',
                              on: 'state',
                              params: { key: 'sightingDone', type: 'boolean', value: 'true' }
                            }
                          ]
                        ]
                      }),
                      element('Paragraph', {
                        attributes: { content: '' },
                        className: 'notice',
                        bindings: [{ to: 'content', source: 'state.sighting' }]
                      })
                    ]
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
                          note('Writes here about animals, and about the people who go out and count them.')
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
 * The same control, starting from what the server already knows.
 *
 * An editor is a form with the record poured into it, and `defaultValue` is where the record goes — bound, like
 * any other attribute. On a server-rendered page the value is in the markup before the browser has done anything,
 * which is why the editor never flashes empty and then fills itself in.
 */
const boundField = (
  name: string,
  labelText: string,
  subType: string,
  source: string,
  extra: Record<string, unknown> = {},
  input = 'input'
): ElementSpec =>
  element('FormControl', {
    attributes: { name, label: labelText, subType, required: true, defaultValue: '', ...extra },
    className: 'fieldRow',
    slots: { input, label: 'fieldLabel' },
    bindings: [{ to: 'defaultValue', source }]
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
                          /**
                           * `input` as an OBJECT, one token per field — not as a line of JSON text with tokens
                           * interpolated into it. The difference is not style: a post body has newlines and
                           * quotation marks in it, and dropping those into a JSON string literal produces a
                           * document that does not parse. The action then refuses the whole call as invalid
                           * input, which reads on screen as the server rejecting a perfectly good post.
                           */
                          params: {
                            actionId: 'publish-post',
                            input: {
                              title: '{{submitted.values.title}}',
                              standfirst: '{{submitted.values.standfirst}}',
                              topic: '{{submitted.values.topic}}',
                              cover: '{{submitted.values.cover}}',
                              body: '{{submitted.values.body}}'
                            },
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
  className: 'page',
  body: [
    chrome('chromeEdit', [
      element('Container', {
        className: 'main',
        children: [
          element('ApiContainer', {
            idRef: 'editPost',
            runtime: 'server',
            attributes: { action: 'get-post', singleRecord: true, subType: 'main' },
            className: 'pageStack',
            children: [
              element('Container', {
                className: 'editor',
                bindings: [shownWhen('apiContainer_editPost.canEdit')],
                children: [
                  element('Container', {
                    className: 'form',
                    children: [
                      element('Heading', {
                        attributes: { subType: 'h1', content: 'Edit post' },
                        className: 'articleTitle'
                      }),
                      bound('Paragraph', 'apiContainer_editPost.record.title', 'articleStandfirst'),
                      element('Form', {
                        idRef: 'editForm',
                        className: 'form',
                        attributes: { managedByInteractions: true, method: 'post' },
                        flows: [
                          [
                            { id: 'edited', type: 'trigger', action: 'onSubmit', on: 'editForm' },
                            {
                              /**
                               * The same global callback the editor on `/write` uses, naming a different action.
                               * The page hands over a name and six values; which post is one of them, and WHO is
                               * not — the session answers that, on the server, where it cannot be edited.
                               */
                              id: 'save',
                              type: 'globalCallback',
                              action: 'runServerAction',
                              on: 'actions',
                              params: {
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
                                },
                                mode: 'await'
                              }
                            },
                            {
                              id: 'refused',
                              type: 'globalCallback',
                              action: 'setState',
                              on: 'state',
                              params: {
                                key: 'notice',
                                type: 'text',
                                value: 'The server refused this: {{save.reason}}'
                              },
                              when: {
                                combinator: 'and',
                                rules: [{ field: 'save.status', operator: '!=', value: 'completed' }]
                              }
                            },
                            {
                              id: 'saved',
                              type: 'globalCallback',
                              action: 'navigate',
                              on: 'navigation',
                              params: { urlType: 'internal', url: '{{save.output.url}}' },
                              when: {
                                combinator: 'and',
                                rules: [{ field: 'save.status', operator: '=', value: 'completed' }]
                              }
                            }
                          ]
                        ],
                        children: [
                          /**
                           * Which post this is, carried in a hidden field rather than read from the URL by the
                           * flow: a form submits VALUES, and the slug is one of them. It is also the only field
                           * the server does not take on trust — the store matches it against the session's own id
                           * before it changes a thing.
                           */
                          boundField('slug', '', 'hidden', 'apiContainer_editPost.record.slug', {}, 'hidden'),
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
                          element('Container', {
                            className: 'actionRow',
                            children: [
                              element('Button', {
                                attributes: { subType: 'submit', content: 'Save changes' },
                                className: 'button'
                              }),
                              boundLink('apiContainer_editPost.record.url', 'buttonQuiet', [label('Cancel')])
                            ]
                          })
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
              element('Container', {
                className: 'centred',
                bindings: [shownWhen('apiContainer_editPost.cannotEdit')],
                children: [
                  element('Container', {
                    className: 'cardSurface',
                    children: [
                      element('Heading', {
                        attributes: { subType: 'h1', content: 'Not yours to edit' },
                        className: 'formTitle'
                      }),
                      note(
                        'You are signed in, and this post belongs to somebody else. The server would refuse the change too — this page is only saying so first.'
                      ),
                      boundLink('apiContainer_editPost.record.url', 'buttonQuiet', [label('Back to the post')])
                    ]
                  })
                ]
              }),
              element('Container', {
                className: 'centred',
                bindings: [shownWhen('apiContainer_editPost.missing')],
                children: [
                  element('Container', {
                    className: 'cardSurface',
                    children: [
                      element('Heading', {
                        attributes: { subType: 'h1', content: 'That post does not exist.' },
                        className: 'formTitle'
                      }),
                      link('/', 'buttonQuiet', [label('Back to the latest')])
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
                  note(
                    'ada / password is on the masthead and may publish. grace / password reads — and is refused, politely, if she tries.'
                  ),
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
