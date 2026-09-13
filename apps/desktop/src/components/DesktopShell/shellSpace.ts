import {
  button,
  column,
  container,
  fontAwesome,
  hostAction,
  image,
  list,
  named,
  onClick,
  row,
  styles,
  text
} from '@plitzi/sdk-authoring';

import type { ElementSpec, SpaceSpec } from '@plitzi/sdk-authoring';

/**
 * This window's sidebar, as a SPACE.
 *
 * It was two hundred lines of React — a nav, a header, a footer, four sets of Tailwind classes and a `collapsed`
 * flag threaded through every one of them. None of it was product logic: it lists what the host hands it and asks
 * the host to act. That is what a space is, and the two things it could not do until now — read the host's data,
 * call back into the host — are the `host` source and the `hostAction` step.
 *
 * It renders OFFLINE, from `authorSpace(desktopShell)` at start-up, so the chrome of this window needs no network,
 * no credential and no space of its own: a packaged app opened on a train still has its sidebar.
 *
 * **What stays in React.** A space cannot host the application's own screens — there is no slot to put them in —
 * so this is the rail only, and the window keeps a flex container with the routed content beside it.
 *
 * **What the host must publish.** Every either/or below is a BOOLEAN on `hostData`, not a truthiness test here: a
 * binding writes only truthy, boolean and number values, so a `visible` reading a string that happens to be empty
 * — or an array that is empty, which is truthy — leaves the element exactly as it was authored. The host decides
 * and says so; see {@link DesktopShell}.
 */

/* -------------------------------------------------------------------------- */
/* Style                                                                       */
/* -------------------------------------------------------------------------- */

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const rail = styles(
  'sh-rail',
  column('0px', {
    width: '264px',
    height: '100%',
    'flex-shrink': '0',
    'background-color': 'var(--rail)',
    'font-family': FONT
  })
);

const head = styles(
  'sh-head',
  row('8px', {
    height: '48px',
    'flex-shrink': '0',
    'align-items': 'center',
    'justify-content': 'space-between',
    padding: '0px 12px',
    'border-bottom': '1px solid var(--rail-line)'
  })
);

const brand = styles(
  'sh-brand',
  row('8px', {
    'align-items': 'center',
    padding: '0px',
    border: '0px',
    'background-color': 'transparent',
    color: '#ffffff',
    'font-family': FONT,
    cursor: 'pointer'
  })
);

const brandMark = styles('sh-mark', { width: '24px', height: '24px', 'flex-shrink': '0' });

const brandName = styles('sh-brand-name', { 'font-size': '17px', 'font-weight': '700' });

const headActions = styles('sh-head-actions', row('2px', { 'align-items': 'center' }));

/**
 * The label of a control whose face is an icon: read aloud, never seen.
 *
 * The first version of this collapsed the button's own text with `font-size: 0` and gave the icon a size back in a
 * rule of its own — and the icon vanished. A Font Awesome glyph is sized in `em` (`fa-1x` is `1em`, and the width
 * comes from `var(--fa-width, 1.25em)`), so an `em` of nothing is nothing; getting the icon back meant winning a
 * cascade fight against Font Awesome's own stylesheet, which is unlayered in the application's bundle and beats a
 * layered rule however specific. Clipping the word instead depends on nothing: the button keeps a real font size,
 * the glyph inherits it, and the label is still in the accessibility tree.
 */
const srOnly = styles('sh-sr', {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: '0px',
  border: '0px',
  overflow: 'hidden',
  'clip-path': 'inset(50%)',
  'white-space': 'nowrap'
});

/** A control whose face is an icon. Its NAME is the clipped word inside it — see {@link srOnly}. */
const iconRules = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '26px',
  height: '26px',
  padding: '0px',
  border: '0px',
  'border-radius': '6px',
  'background-color': 'transparent',
  color: 'var(--rail-dim)',
  'font-size': '12px',
  cursor: 'pointer'
};

/**
 * The same control three times, under three names.
 *
 * A name each, and not one shared class, because the narrow rail keeps one of them and drops the other two — and a
 * rule can only say which if there is something to say it about.
 */
const refreshButton = styles('sh-refresh', iconRules);
const collapseButton = styles('sh-collapse', iconRules);
const signOutButton = styles('sh-signout', iconRules);

const listStack = styles(
  'sh-list',
  column('2px', {
    width: '100%',
    margin: '0px',
    padding: '8px 8px 0px',
    'list-style': 'none'
  })
);

const scroller = styles('sh-scroll', column('0px', { flex: '1', 'min-height': '0px', 'overflow-y': 'auto' }));

const spaceRow = styles(
  'sh-space',
  row('10px', {
    'align-items': 'center',
    width: '100%',
    padding: '7px 8px',
    'border-radius': '6px',
    border: '0px',
    'background-color': 'transparent',
    color: 'var(--rail-dim)',
    'font-family': FONT,
    'font-size': '14px',
    'text-align': 'left',
    cursor: 'pointer'
  })
);

const badge = styles('sh-badge', {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'flex-shrink': '0',
  width: '24px',
  height: '24px',
  'border-radius': '6px',
  'background-color': 'var(--rail-badge)',
  color: 'var(--rail-badge-ink)',
  'font-size': '11px',
  'font-weight': '700',
  'text-transform': 'uppercase'
});

const spaceName = styles('sh-name', {
  flex: '1',
  overflow: 'hidden',
  'white-space': 'nowrap',
  'text-overflow': 'ellipsis'
});

const groupLabel = styles(
  'sh-group',
  row('8px', {
    'align-items': 'center',
    padding: '14px 10px 4px',
    color: 'var(--rail-faint)',
    'font-size': '10px',
    'font-weight': '700',
    'letter-spacing': '0.08em'
  })
);

const groupText = styles('sh-group-text', { 'white-space': 'nowrap' });

const note = styles('sh-note', {
  padding: '12px 10px',
  color: 'var(--rail-faint)',
  'font-size': '12px',
  'line-height': '1.5'
});

const statusLine = styles(
  'sh-status',
  row('8px', {
    'flex-shrink': '0',
    'align-items': 'center',
    padding: '8px 12px',
    'border-top': '1px solid var(--rail-line)',
    'font-size': '12px'
  })
);

const foot = styles(
  'sh-foot',
  row('8px', {
    'flex-shrink': '0',
    'align-items': 'center',
    padding: '8px',
    'border-top': '1px solid var(--rail-line)'
  })
);

const avatar = styles('sh-avatar', {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'flex-shrink': '0',
  width: '30px',
  height: '30px',
  'border-radius': '999px',
  'background-color': 'var(--rail-badge)',
  color: 'var(--rail-badge-ink)',
  'font-size': '12px',
  'font-weight': '700',
  'text-transform': 'uppercase'
});

const identity = styles('sh-identity', column('1px', { flex: '1', 'min-width': '0px' }));

const identityName = styles('sh-identity-name', {
  overflow: 'hidden',
  color: '#e4e4e7',
  'font-size': '13px',
  'white-space': 'nowrap',
  'text-overflow': 'ellipsis'
});

const identityMail = styles('sh-identity-mail', {
  overflow: 'hidden',
  color: 'var(--rail-faint)',
  'font-size': '11px',
  'white-space': 'nowrap',
  'text-overflow': 'ellipsis'
});

/* -------------------------------------------------------------------------- */
/* The two computed classes                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Whether the rail is narrow, as the rail's own class.
 *
 * The whole collapsed look is this one class and the rules below that read it. The alternative is the flag the
 * React version threaded through every part, and that flag appeared in nine `clsx` calls.
 */
const collapsedClass = {
  action: 'twigTemplate',
  params: { template: '{{ host.collapsed ? "sh-rail sh-collapsed" : "sh-rail" }}' }
};

/**
 * Whether THIS row is the space that is open.
 *
 * The question compares two things — the row's own url against the one the host says is open — and a binding reads
 * one source, so the comparison is a template and what it writes is the row's class. The second binding is what
 * makes the first work: an element subscribes only to the sources its bindings NAME, so without it the row's own
 * value is not in scope and the template compares against nothing.
 */
const openClass = (listId: string) => ({
  action: 'twigTemplate',
  params: { template: `{{ host.openSpace == ${listId}.item.url ? "sh-space sh-open" : "sh-space" }}` }
});

/** One row, in whichever of the two lists. The list's id is part of every token the row reads, so it is a parameter. */
const spaceRowFor = (listId: string): ElementSpec =>
  button({
    id: `${listId}-row`,
    subType: 'button',
    content: '',
    class: spaceRow,
    bind: [
      {
        to: 'styleSelectors.base',
        source: 'host.openSpace',
        category: 'initialState',
        transformers: [openClass(listId)]
      },
      { to: 'data-url', source: `${listId}.item.url` }
    ],
    children: [
      text({ id: `${listId}-badge`, class: badge, bind: { content: `${listId}.item.initial` } }),
      text({ id: `${listId}-name`, class: spaceName, bind: { content: `${listId}.item.name` } })
    ],
    flows: [
      [named(`${listId}-open`, onClick()), hostAction({ action: 'openSpace', value: `{{ ${listId}.item.url }}` })]
    ]
  });

/* -------------------------------------------------------------------------- */
/* The space                                                                   */
/* -------------------------------------------------------------------------- */

export const desktopShell: SpaceSpec = {
  name: 'Desktop Shell',
  permanentUrl: 'desktop-shell',
  variables: {
    color: {
      rail: { light: '#18181b', dark: '#18181b', default: '#18181b' },
      'rail-line': { light: '#27272a', dark: '#27272a', default: '#27272a' },
      'rail-dim': { light: '#a1a1aa', dark: '#a1a1aa', default: '#a1a1aa' },
      'rail-faint': { light: '#71717a', dark: '#71717a', default: '#71717a' },
      'rail-badge': { light: '#3f3f46', dark: '#3f3f46', default: '#3f3f46' },
      'rail-badge-ink': { light: '#e4e4e7', dark: '#e4e4e7', default: '#e4e4e7' },
      'rail-open': { light: '#6366f1', dark: '#6366f1', default: '#6366f1' }
    }
  },
  customCss: [
    /* The rail is the same in both themes on purpose: it is the application's chrome, not the space's page, and a
       rail that changes colour with the space open inside it reads as part of that space. */
    '.sh-space:hover { background-color: #27272a; color: #e4e4e7; }',
    '.sh-open { background-color: #3f3f46; color: #ffffff; }',
    '.sh-open .sh-badge { background-color: var(--rail-open); color: #ffffff; }',
    '.sh-refresh:hover, .sh-collapse:hover, .sh-signout:hover { background-color: #27272a; color: #e4e4e7; }',
    '.sh-group::after { content: ""; flex: 1; height: 1px; background-color: var(--rail-line); }',
    '.sh-status-offline { color: #fbbf24; }',
    '.sh-status-error { color: #f87171; }',
    /* Collapsed: the rail keeps its icons and loses its words — read from the one class above, in one place. */
    '.sh-collapsed { width: 56px; }',
    /* Fifty-six pixels holds ONE control. The brand and the two other buttons go, the way out of the narrow rail
       stays — a rail with no way back out is a rail you reopen by restarting the application. */
    '.sh-collapsed .sh-brand,',
    '.sh-collapsed .sh-name,',
    '.sh-collapsed .sh-identity,',
    '.sh-collapsed .sh-note,',
    '.sh-collapsed .sh-status span,',
    '.sh-collapsed .sh-group-text,',
    '.sh-collapsed .sh-signout,',
    '.sh-collapsed .sh-refresh { display: none; }',
    '.sh-collapsed .sh-head, .sh-collapsed .sh-foot, .sh-collapsed .sh-status { justify-content: center; padding-left: 4px; padding-right: 4px; }',
    '.sh-collapsed .sh-space { justify-content: center; }',
    '.sh-collapsed .sh-list { padding-left: 4px; padding-right: 4px; }',
    /* The heading becomes what it was always standing in for: a line between two groups. */
    '.sh-collapsed .sh-group { padding: 10px 8px; }',
    '.sh-collapsed .sh-group::after { flex: 1; }'
  ].join('\n'),
  pages: [
    {
      id: 'rail-page',
      name: 'Rail',
      slug: '',
      isDefault: true,
      body: [
        container({
          id: 'rail',
          class: rail,
          bind: [
            {
              to: 'styleSelectors.base',
              source: 'host.collapsed',
              category: 'initialState',
              transformers: [collapsedClass]
            }
          ],
          children: [
            container({
              id: 'head',
              class: head,
              children: [
                // A button and not a container: it is clickable, and the accessible name it needs is the word
                // already inside it — `content` is empty so the element publishes no `aria-label` and the browser
                // reads the children, which say Plitzi.
                button({
                  id: 'brand',
                  subType: 'button',
                  content: '',
                  class: brand,
                  children: [
                    image({
                      id: 'brand-mark',
                      class: brandMark,
                      src: 'https://cdn.plitzi.com/resources/img/favicon.svg',
                      alt: ''
                    }),
                    text({ id: 'brand-name', class: brandName, content: 'Plitzi' })
                  ],
                  flows: [[named('do-home', onClick()), hostAction({ action: 'home' })]]
                }),
                container({
                  id: 'head-actions',
                  class: headActions,
                  children: [
                    button({
                      id: 'refresh',
                      subType: 'button',
                      content: '',
                      class: refreshButton,
                      children: [
                        text({ id: 'refresh-label', class: srOnly, content: 'Refresh your spaces' }),
                        fontAwesome({ id: 'refresh-icon', icon: 'fa-solid fa-rotate-right' })
                      ],
                      flows: [[named('do-refresh', onClick()), hostAction({ action: 'refresh' })]]
                    }),
                    button({
                      id: 'collapse',
                      subType: 'button',
                      content: '',
                      class: collapseButton,
                      // The arrow turns around when the rail is narrow, and the host publishes both names in full:
                      // a binding does not write an empty string, so a modifier that is sometimes '' would stick.
                      children: [
                        // The word turns around with the arrow: "Collapse" read out on a rail already collapsed is
                        // the one thing somebody who cannot see the arrow would be told wrong.
                        text({
                          id: 'collapse-label',
                          class: srOnly,
                          content: 'Collapse the sidebar',
                          bind: { content: 'host.collapseLabel' }
                        }),
                        fontAwesome({
                          id: 'collapse-icon',
                          icon: 'fa-solid fa-angles-left',
                          bind: { icon: 'host.collapseIcon' }
                        })
                      ],
                      flows: [[named('do-collapse', onClick()), hostAction({ action: 'toggleSidebar' })]]
                    })
                  ]
                })
              ]
            }),
            container({
              id: 'scroller',
              class: scroller,
              children: [
                container({
                  id: 'loading-note',
                  class: note,
                  visible: 'host.loading',
                  children: [text({ id: 'loading-text', content: 'Loading your spaces…' })]
                }),
                container({
                  id: 'empty-note',
                  class: note,
                  visible: 'host.empty',
                  children: [
                    text({
                      id: 'empty-text',
                      content: 'No spaces yet. Create one at plitzi.com and it will show up here.'
                    })
                  ]
                }),
                list({
                  id: 'owned',
                  source: 'controlled',
                  subType: 'ul',
                  class: listStack,
                  bind: { items: 'host.spaces' },
                  children: [spaceRowFor('list_owned')]
                }),
                container({
                  id: 'shared-label',
                  class: groupLabel,
                  visible: 'host.hasGuests',
                  children: [text({ id: 'shared-text', class: groupText, content: 'SHARED WITH ME' })]
                }),
                list({
                  id: 'shared',
                  source: 'controlled',
                  subType: 'ul',
                  class: listStack,
                  bind: { items: 'host.guestSpaces' },
                  children: [spaceRowFor('list_shared')]
                })
              ]
            }),
            /*
              Said beside the list rather than in a header, and only when there is something to say. It has to be
              said somewhere: this window can be open on a machine that is offline, and a list that failed to
              refresh looks exactly like an account with no spaces in it.
            */
            container({
              id: 'status',
              class: statusLine,
              visible: 'host.hasStatus',
              bind: [{ to: 'styleSelectors.base', source: 'host.statusClass', category: 'initialState' }],
              children: [
                fontAwesome({ id: 'status-dot', icon: 'fa-solid fa-circle', size: 'fa-2xs' }),
                text({ id: 'status-text', bind: { content: 'host.status' } })
              ]
            }),
            container({
              id: 'foot',
              class: foot,
              visible: 'host.signedIn',
              children: [
                text({ id: 'avatar', class: avatar, bind: { content: 'host.user.initial' } }),
                container({
                  id: 'identity',
                  class: identity,
                  children: [
                    text({ id: 'identity-name', class: identityName, bind: { content: 'host.user.name' } }),
                    text({ id: 'identity-mail', class: identityMail, bind: { content: 'host.user.email' } })
                  ]
                }),
                button({
                  id: 'signout',
                  subType: 'button',
                  content: '',
                  class: signOutButton,
                  children: [
                    text({ id: 'signout-label', class: srOnly, content: 'Sign out' }),
                    fontAwesome({ id: 'signout-icon', icon: 'fa-solid fa-right-from-bracket' })
                  ],
                  flows: [[named('do-signout', onClick()), hostAction({ action: 'signOut' })]]
                })
              ]
            })
          ]
        })
      ]
    }
  ]
};

export default desktopShell;
