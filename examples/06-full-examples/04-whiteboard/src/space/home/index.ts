import {
  apiContainer,
  bindTemplate,
  channel,
  container,
  delay,
  list,
  on,
  onPageLoad,
  reloadApi,
  styles,
  text,
  themeToggle,
  variantFrom,
  whileRunning
} from '@plitzi/sdk-authoring';

import { LIST_ACTION } from '../../actions.ts';
import { COLLAB_COLOURS } from '../../board/people.ts';
import { GALLERY_PROVIDER } from '../ids.ts';
import { BUTTON_RESET, icon } from '../kit.ts';
import { identity } from '../state.ts';
import { featured, recent, templates } from './catalogue.ts';
import { hero } from './hero.ts';

import type { CssProps, ElementSpec, PageSpec } from '@plitzi/sdk-authoring';

/**
 * The front page — where people arrive, so it shows what this is by letting them do it: a canvas to scribble on
 * before anything else, templates drawn small, the featured boards to walk into, and who else is here right now.
 *
 * It stays current by itself. Every commit anywhere is announced on the `boards` topic and the page reads the list
 * again — at most once every second and a half, however busy the boards are — and the `lobby` channel says who is
 * on this page with you.
 */

const page = styles('galleryPage', {
  'min-height': '100dvh',
  'background-color': 'var(--paper)',
  'background-image': 'radial-gradient(var(--dots) 1px, transparent 1px)',
  'background-size': '24px 24px',
  color: 'var(--ink)',
  'font-family': 'var(--ui)',
  'line-height': '1.4'
});

const shell = styles('shell', {
  css: {
    desktop: {
      'max-width': '1200px',
      margin: '0px auto',
      padding: '24px 32px 64px',
      display: 'flex',
      'flex-direction': 'column',
      gap: '56px'
    },
    mobile: { padding: '16px 16px 48px', gap: '40px' }
  }
});

const topBar = styles('topBar', {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '12px'
});

const brand = styles('brand', {
  display: 'inline-flex',
  'align-items': 'center',
  gap: '10px',
  'font-family': 'var(--hand)',
  'font-size': '28px',
  'font-weight': '700'
});

const brandMark = styles('brandMark', {
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '40px',
  height: '40px',
  'border-radius': '12px',
  'background-color': 'var(--accent)',
  color: 'var(--on-accent)',
  'font-size': '17px',
  transform: 'rotate(-6deg)'
});

const barEnd = styles('barEnd', { display: 'flex', 'align-items': 'center', gap: '14px' });

const here = styles('hereNow', {
  display: 'flex',
  'align-items': 'center',
  gap: '10px',
  padding: '4px 12px 4px 6px',
  'border-radius': '999px',
  border: '1px solid var(--edge)',
  'background-color': 'var(--surface)',
  'font-size': '13px',
  'font-weight': '600'
});

const faces = styles('faces', { display: 'flex', margin: '0px', padding: '0px', 'list-style-type': 'none' });

const FACE: CssProps = {
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '26px',
  height: '26px',
  'margin-left': '-6px',
  'border-radius': '50%',
  border: '2px solid var(--surface)',
  'font-size': '11px',
  'font-weight': '700',
  color: '#ffffff',
  'background-color': 'var(--muted)'
};

const face = styles('face', {
  css: FACE,
  variants: Object.fromEntries(
    COLLAB_COLOURS.map(colour => [colour, { 'background-color': `var(--collab-${colour})` }])
  )
});

const themeSwitch = styles('galleryTheme', {
  css: {
    ...BUTTON_RESET,
    display: 'inline-flex',
    width: '40px',
    height: '40px',
    'align-items': 'center',
    'justify-content': 'center',
    'border-radius': '12px',
    'background-color': 'var(--surface)',
    border: '1px solid var(--edge)'
  },
  states: { hover: { 'background-color': 'var(--surface-2)' } }
});

const footnote = styles('footnote', {
  display: 'block',
  padding: '0px 16px 32px',
  'font-size': '12px',
  color: 'var(--muted)',
  'text-align': 'center'
});

/** Everyone on the front page right now, this visitor among them: faces, and how many. */
const hereNow = (): ElementSpec =>
  container({
    class: here,
    children: [
      list({
        id: 'visitors',
        source: 'controlled',
        class: faces,
        bind: [
          bindTemplate(
            'items',
            'lobby.members',
            '{{ source|filter(member => member.state.name is defined)|slice(0, 6) }}',
            {
              returns: 'value'
            }
          )
        ],
        children: [
          container({
            subType: 'li',
            children: [
              text({
                content: '',
                class: face,
                bind: [
                  bindTemplate('content', 'visitors.item.state.name', '{{ source|first|upper }}'),
                  variantFrom(face, 'visitors.item.state.color')
                ]
              })
            ]
          })
        ]
      }),
      text({
        content: '',
        bind: [
          bindTemplate(
            'content',
            'lobby.members',
            "{{ (source|length) <= 1 ? 'Just you here' : (source|length) ~ ' people here now' }}"
          )
        ]
      })
    ]
  });

export const galleryPage: PageSpec = {
  name: 'Boards',
  slug: '',
  seoTitle: 'Pizarra — draw together',
  seoDescription:
    'An infinite whiteboard in a hand-drawn stroke: templates, sticky piles, live cursors, voting and a shared timer. Start a board and send the link.',
  class: page,
  flows: [[onPageLoad(), ...identity]],
  body: [
    // Who is on the front page: this visitor announces its name and colour, and hears everyone else's.
    channel({
      id: 'lobby',
      topic: 'lobby',
      keep: 0,
      bind: { presence: 'computed.me' },
      children: [
        apiContainer({
          id: GALLERY_PROVIDER,
          subType: 'div',
          runtime: 'server',
          action: LIST_ACTION,
          renderWhileLoading: true,
          children: [
            /**
             * Somebody drew somewhere: read the list again. `skip` while the wait runs, so a burst of commits across
             * every board is one re-read, a second and a half after the first of them.
             */
            channel({
              id: 'changes',
              topic: 'boards',
              keep: 0,
              flows: [[whileRunning('skip', on('onMessage')), delay(1500), reloadApi(GALLERY_PROVIDER)]]
            }),
            container({
              class: shell,
              children: [
                container({
                  class: topBar,
                  children: [
                    container({
                      class: brand,
                      children: [
                        container({ class: brandMark, children: [icon('fa-solid fa-pencil')] }),
                        text({ content: 'Pizarra' })
                      ]
                    }),
                    container({
                      class: barEnd,
                      children: [hereNow(), themeToggle({ id: 'gallery-theme', subType: 'switch', class: themeSwitch })]
                    })
                  ]
                }),
                hero(),
                templates(),
                featured(),
                recent()
              ]
            }),
            text({ content: 'Boards live in this server’s memory — a restart clears them.', class: footnote })
          ]
        })
      ]
    })
  ]
};
