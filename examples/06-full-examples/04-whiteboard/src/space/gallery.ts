import {
  apiContainer,
  bindTemplate,
  button,
  channel,
  container,
  defineElement,
  delay,
  heading,
  link,
  list,
  on,
  paragraph,
  reloadApi,
  styles,
  text,
  themeToggle,
  whileRunning
} from '@plitzi/sdk-authoring';

import { LIST_ACTION } from '../actions.ts';
import declaration from '../plugins/Board/declaration.ts';
import { newBoardFlow, primaryButton } from './board.ts';
import { GALLERY_PROVIDER } from './ids.ts';
import { BUTTON_RESET, icon } from './kit.ts';

import type { BoardAttributes } from '../plugins/Board/declaration.ts';
import type { ElementSpec, PageSpec } from '@plitzi/sdk-authoring';

/**
 * The front page: what this is, a button that starts a board, and the boards touched last — each drawn small by the
 * same canvas, in `view` mode, from the preview the server keeps beside it.
 *
 * It stays current by itself. Every commit anywhere is announced on the `boards` topic, and the page reads the list
 * again — at most once every second and a half, however busy the boards are.
 */

const thumbnail = defineElement<BoardAttributes>(declaration);

/** The board's paper, dots and all, under the whole front page: what you are about to draw on. */
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
      'max-width': '1120px',
      margin: '0px auto',
      padding: '28px 32px 64px',
      display: 'flex',
      'flex-direction': 'column',
      gap: '40px'
    },
    mobile: { padding: '18px 16px 48px', gap: '28px' }
  }
});

const topBar = styles('topBar', { display: 'flex', 'align-items': 'center', 'justify-content': 'space-between' });

const brand = styles('brand', {
  display: 'inline-flex',
  'align-items': 'center',
  gap: '10px',
  'font-family': 'var(--hand)',
  'font-size': '26px',
  'font-weight': '700'
});

const brandMark = styles('brandMark', {
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '38px',
  height: '38px',
  'border-radius': '10px',
  'background-color': 'var(--accent)',
  color: 'var(--on-accent)',
  'font-size': '17px'
});

const themeSwitch = styles('galleryTheme', {
  css: {
    ...BUTTON_RESET,
    display: 'inline-flex',
    width: '38px',
    height: '38px',
    'align-items': 'center',
    'justify-content': 'center',
    'border-radius': '10px',
    'background-color': 'var(--surface)',
    border: '1px solid var(--edge)'
  },
  states: { hover: { 'background-color': 'var(--surface-2)' } }
});

const hero = styles('hero', {
  css: {
    desktop: {
      display: 'flex',
      'flex-direction': 'column',
      'align-items': 'flex-start',
      gap: '18px',
      'padding-top': '24px'
    },
    mobile: { 'padding-top': '8px' }
  }
});

const heroTitle = styles('heroTitle', {
  css: {
    desktop: {
      margin: '0px',
      'font-family': 'var(--hand)',
      'font-size': '64px',
      'font-weight': '700',
      'line-height': '1.05',
      color: 'var(--ink)'
    },
    mobile: { 'font-size': '42px' }
  }
});

const heroLead = styles('heroLead', {
  margin: '0px',
  'max-width': '560px',
  'font-size': '17px',
  'line-height': '1.55',
  color: 'var(--muted)'
});

const sectionHead = styles('sectionHead', {
  display: 'flex',
  'align-items': 'baseline',
  'justify-content': 'space-between',
  gap: '12px'
});

const sectionTitle = styles('sectionTitle', { margin: '0px', 'font-size': '18px', 'font-weight': '600' });

const sectionMeta = styles('sectionMeta', { 'font-size': '13px', color: 'var(--muted)' });

const grid = styles('boardGrid', {
  css: {
    desktop: {
      display: 'grid',
      'grid-template-columns': 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: '18px',
      margin: '0px',
      padding: '0px',
      'list-style-type': 'none'
    },
    mobile: { 'grid-template-columns': 'minmax(0px, 1fr)' }
  }
});

const card = styles('boardCard', {
  css: {
    display: 'flex',
    'flex-direction': 'column',
    overflow: 'hidden',
    'border-radius': '14px',
    border: '1px solid var(--edge)',
    'background-color': 'var(--surface)',
    color: 'var(--ink)',
    'text-decoration': 'none',
    'box-shadow': '0 1px 2px var(--shadow)',
    transition: 'transform 160ms ease, box-shadow 160ms ease'
  },
  states: {
    hover: { transform: 'translateY(-2px)', 'box-shadow': '0 14px 30px -14px var(--shadow)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '3px' }
  }
});

/** The thumbnail's frame. The canvas inside is `thumbCanvas`, which `css.ts` gives the board's colours. */
const thumbFrame = styles('thumbFrame', {
  position: 'relative',
  height: '160px',
  'background-color': 'var(--paper)',
  'border-bottom': '1px solid var(--edge)'
});

export const thumbCanvas = styles('thumbCanvas', { position: 'absolute', inset: '0px' });

const cardBody = styles('cardBody', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '4px',
  padding: '12px 14px 14px'
});

const cardTitle = styles('cardTitle', {
  'font-weight': '600',
  'font-size': '15px',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap'
});

const cardMeta = styles('cardMeta', { 'font-size': '12px', color: 'var(--muted)' });

const empty = styles('emptyBoards', {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '6px',
  padding: '48px 24px',
  'border-radius': '14px',
  border: '2px dashed var(--edge)',
  'text-align': 'center',
  color: 'var(--muted)'
});

const emptyTitle = styles('emptyTitle', { 'font-family': 'var(--hand)', 'font-size': '26px', color: 'var(--ink)' });

const footnote = styles('footnote', {
  display: 'block',
  padding: '0px 16px 32px',
  'font-size': '12px',
  color: 'var(--muted)',
  'text-align': 'center'
});

const boardCard = (): ElementSpec =>
  container({
    subType: 'li',
    children: [
      link({
        href: '#',
        mode: 'internal',
        class: card,
        bind: [bindTemplate('href', 'boards.item.id', '/b/{{ source }}')],
        children: [
          container({
            class: thumbFrame,
            children: [
              thumbnail({
                runtime: 'client',
                class: thumbCanvas,
                mode: 'view',
                bind: [
                  { to: 'boardId', source: 'boards.item.id' },
                  { to: 'elements', source: 'boards.item.preview' },
                  { to: 'scheme', source: 'theme.resolved' }
                ]
              })
            ]
          }),
          container({
            class: cardBody,
            children: [
              text({ content: '', class: cardTitle, bind: { content: 'boards.item.title' } }),
              text({
                content: '',
                class: cardMeta,
                bind: [
                  bindTemplate(
                    'content',
                    'boards.item',
                    "{{ source.count }} {{ source.count == 1 ? 'element' : 'elements' }} · {{ source.updatedAt|date('d M, H:i', 'UTC') }} UTC"
                  )
                ]
              })
            ]
          })
        ]
      })
    ]
  });

const boards = (): ElementSpec =>
  apiContainer({
    id: GALLERY_PROVIDER,
    subType: 'section',
    runtime: 'server',
    action: LIST_ACTION,
    renderWhileLoading: true,
    children: [
      /**
       * Somebody drew somewhere: read the list again. `skip` while the wait runs, so a burst of commits across every
       * board is one re-read, a second and a half after the first of them.
       */
      channel({
        id: 'lobby',
        topic: 'boards',
        keep: 0,
        flows: [[whileRunning('skip', on('onMessage')), delay(1500), reloadApi(GALLERY_PROVIDER)]]
      }),
      container({
        class: shell,
        children: [
          container({
            class: sectionHead,
            children: [
              heading({ content: 'Recent boards', subType: 'h2', class: sectionTitle }),
              text({
                content: '',
                class: sectionMeta,
                bind: [
                  bindTemplate(
                    'content',
                    `${GALLERY_PROVIDER}.boards`,
                    "{{ source|length }} {{ (source|length) == 1 ? 'board' : 'boards' }}"
                  )
                ]
              })
            ]
          }),
          list({
            id: 'boards',
            source: 'controlled',
            class: grid,
            bind: { items: `${GALLERY_PROVIDER}.boards` },
            children: [boardCard()]
          }),
          container({
            id: 'no-boards',
            class: empty,
            visible: {
              source: `${GALLERY_PROVIDER}.boards`,
              template: "{{ (source|length) == 0 ? 'true' : 'false' }}"
            },
            children: [
              text({ content: 'A clean slate', class: emptyTitle }),
              text({ content: 'Nobody has drawn anything yet. Start the first board — then send the link to someone.' })
            ]
          })
        ]
      })
    ]
  });

export const galleryPage: PageSpec = {
  name: 'Boards',
  slug: '',
  seoTitle: 'Pizarra — draw together',
  seoDescription: 'A whiteboard for everyone in the room: start a board, share the link, and draw together, live.',
  class: page,
  body: [
    container({
      children: [
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
                themeToggle({ id: 'gallery-theme', subType: 'switch', class: themeSwitch })
              ]
            }),
            container({
              class: hero,
              children: [
                heading({ content: 'Draw together.', subType: 'h1', class: heroTitle }),
                paragraph({
                  content:
                    'An infinite board in a hand-drawn stroke. Start one, send the link, and everyone on it sees every shape, cursor and sticky note the moment it happens.',
                  class: heroLead
                }),
                button({
                  id: 'new-board',
                  content: 'Start a board',
                  class: primaryButton,
                  flows: [newBoardFlow],
                  children: [icon('fa-solid fa-plus')]
                })
              ]
            })
          ]
        }),
        boards(),
        text({
          content: 'Boards live in this server’s memory — a restart clears them.',
          class: footnote
        })
      ]
    })
  ]
};
