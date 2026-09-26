import {
  bindTemplate,
  button,
  container,
  defineElement,
  formControl,
  link,
  list,
  named,
  navigate,
  on,
  onClick,
  runServerAction,
  setState,
  styles,
  text
} from '@plitzi/sdk-authoring';

import { CREATE_ACTION } from '../../actions.ts';
import { templateElements } from '../../board/templates.ts';
import declaration from '../../plugins/Board/declaration.ts';
import { keepOwned } from '../access.ts';
import { GALLERY_PROVIDER } from '../ids.ts';
import { BUTTON_RESET, icon } from '../kit.ts';
import {
  cardBody,
  cardLine,
  cardName,
  HOME_CARD,
  HOME_CARD_STATES,
  sectionBlock,
  sectionHead,
  sectionLead
} from './section.ts';

import type { Template } from '../../board/templates.ts';
import type { BoardAttributes } from '../../plugins/Board/declaration.ts';
import type { CssProps, ElementSpec } from '@plitzi/sdk-authoring';

/**
 * What the front page offers below its hero: templates to start from, the boards already drawn to look around in,
 * and every board touched lately — each drawn small by the same canvas in `view` mode.
 */

const thumbnail = defineElement<BoardAttributes>(declaration);

export const thumbCanvas = styles('thumbCanvas', { position: 'absolute', inset: '0px' });

const blockHead = styles('blockHead', {
  display: 'flex',
  'align-items': 'flex-end',
  'justify-content': 'space-between',
  gap: '16px',
  'flex-wrap': 'wrap'
});

const CARD: CssProps = {
  ...BUTTON_RESET,
  ...HOME_CARD,
  'text-align': 'left',
  'text-decoration': 'none'
};

const frame = (name: string, height: string) =>
  styles(name, {
    position: 'relative',
    height,
    overflow: 'hidden',
    'background-color': 'var(--paper)',
    'border-bottom': '1px solid var(--edge)'
  });

// ── Templates ──────────────────────────────────────────────────────────────────────────────────────────────────────

const TEMPLATE_CARDS: readonly { template: Template; title: string; note: string }[] = [
  { template: 'blank', title: 'Blank board', note: 'Just paper' },
  { template: 'kanban', title: 'Kanban', note: 'Columns that sort their cards' },
  { template: 'brainstorm', title: 'Brainstorm', note: 'A question, a pile, a parking lot' },
  { template: 'retro', title: 'Retro', note: 'Went well · improve · actions' },
  { template: 'flowchart', title: 'Flowchart', note: 'Steps, decisions, a database' },
  { template: 'mindmap', title: 'Mind map', note: 'Click a point to grow a branch' },
  { template: 'roadmap', title: 'Roadmap', note: 'Quarters, cards — and present it' },
  { template: 'meeting', title: 'Weekly sync', note: 'Agenda to tick, notes, actions' }
];

const templateGrid = styles('templateGrid', {
  css: {
    desktop: { display: 'grid', 'grid-template-columns': 'repeat(4, minmax(0px, 1fr))', gap: '14px' },
    tablet: { 'grid-template-columns': 'repeat(3, minmax(0px, 1fr))' },
    mobile: { 'grid-template-columns': 'repeat(2, minmax(0px, 1fr))' }
  }
});

const templateCard = styles('templateCard', { css: CARD, states: HOME_CARD_STATES });

const templateFrame = frame('templateFrame', '130px');

const blankMark = styles('blankMark', {
  position: 'absolute',
  inset: '0px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'font-size': '34px',
  color: 'var(--accent)'
});

/** A template's card: the template itself, drawn small — the board a click starts is the board shown. */
const templateCardFor = (entry: (typeof TEMPLATE_CARDS)[number]): ElementSpec =>
  button({
    id: `template-${entry.template}`,
    content: '',
    title: `Start a board: ${entry.title}`,
    class: templateCard,
    flows: [
      [
        onClick(),
        named(
          `made_${entry.template}`,
          runServerAction({
            actionId: CREATE_ACTION,
            input: { template: entry.template, title: '' },
            invalidateQueries: 'none'
          })
        ),
        keepOwned(`made_${entry.template}`),
        navigate({ urlType: 'internal', url: `/b/{{ made_${entry.template}.output.id }}` })
      ]
    ],
    children: [
      container({
        class: templateFrame,
        children:
          entry.template === 'blank'
            ? [container({ class: blankMark, children: [icon('fa-solid fa-plus')] })]
            : [
                thumbnail({
                  runtime: 'client',
                  class: thumbCanvas,
                  mode: 'view',
                  boardId: `template-${entry.template}`,
                  elements: templateElements(entry.template),
                  bind: [{ to: 'scheme', source: 'theme.resolved' }]
                })
              ]
      }),
      container({
        class: cardBody,
        children: [text({ content: entry.title, class: cardName }), text({ content: entry.note, class: cardLine })]
      })
    ]
  });

export const templates = (): ElementSpec =>
  container({
    class: sectionBlock,
    children: [
      sectionHead({
        tone: 'amber',
        eyebrow: 'Templates',
        title: 'Start from a template',
        lead: 'Every one is an ordinary board: change anything.'
      }),
      container({ class: templateGrid, children: TEMPLATE_CARDS.map(templateCardFor) })
    ]
  });

// ── Boards ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const boardCard = styles('boardCard', { css: CARD, states: HOME_CARD_STATES });

const lockedFrame = styles('lockedFrame', {
  position: 'absolute',
  inset: '0px',
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  'justify-content': 'center',
  gap: '6px',
  'font-size': '28px',
  color: 'var(--muted)',
  'background-image':
    'repeating-linear-gradient(45deg, transparent 0px, transparent 10px, var(--surface-2) 10px, var(--surface-2) 20px)'
});

const lockedLabel = styles('lockedLabel', { 'font-size': '12px', 'font-weight': '600' });

/** Over the picture, in glass: what a featured board is, said quietly. */
const badge = styles('featuredBadge', {
  position: 'absolute',
  top: '12px',
  right: '12px',
  display: 'inline-flex',
  'align-items': 'center',
  gap: '6px',
  padding: '5px 10px',
  'border-radius': '999px',
  'font-size': '11px',
  'font-weight': '600',
  color: 'var(--ink)',
  'background-color': 'color-mix(in srgb, var(--surface) 82%, transparent)',
  border: '1px solid var(--edge)',
  'backdrop-filter': 'blur(8px)',
  'box-shadow': '0 4px 12px -6px var(--shadow)'
});

/** One board as a card, for a list whose id is `list`: its preview — or its lock — its name, and what is on it. */
const card = (listId: string, frameClass: ReturnType<typeof frame>, featured: boolean): ElementSpec =>
  container({
    subType: 'li',
    children: [
      link({
        href: '#',
        mode: 'internal',
        class: boardCard,
        bind: [bindTemplate('href', `${listId}.item.id`, '/b/{{ source }}')],
        children: [
          container({
            class: frameClass,
            children: [
              thumbnail({
                runtime: 'client',
                class: thumbCanvas,
                mode: 'view',
                bind: [
                  { to: 'boardId', source: `${listId}.item.id` },
                  { to: 'elements', source: `${listId}.item.preview` },
                  bindTemplate('assetBase', `${listId}.item.id`, '/board-assets/{{ source }}'),
                  { to: 'scheme', source: 'theme.resolved' }
                ]
              }),
              // A locked board shows that it exists, and nothing of it.
              container({
                class: lockedFrame,
                visible: `${listId}.item.locked`,
                children: [text({ content: '🔒' }), text({ content: 'Protected', class: lockedLabel })]
              }),
              ...(featured ? [text({ content: 'Read-only · template', class: badge })] : [])
            ]
          }),
          container({
            class: cardBody,
            children: [
              text({ content: '', class: cardName, bind: { content: `${listId}.item.title` } }),
              text({
                content: '',
                class: cardLine,
                bind: [
                  bindTemplate(
                    'content',
                    `${listId}.item`,
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

const featuredGrid = styles('featuredGrid', {
  css: {
    desktop: {
      display: 'grid',
      'grid-template-columns': 'repeat(2, minmax(0px, 1fr))',
      gap: '18px',
      margin: '0px',
      padding: '0px',
      'list-style-type': 'none'
    },
    mobile: { 'grid-template-columns': 'minmax(0px, 1fr)' }
  }
});

export const featured = (): ElementSpec =>
  container({
    class: sectionBlock,
    children: [
      sectionHead({
        tone: 'coral',
        eyebrow: 'Showcase',
        title: 'Walk into a finished board',
        lead: 'Boards a team has lived in — hundreds of elements, every kind there is. Walk around with whoever is in there right now; like one? Use it as a template.'
      }),
      list({
        id: 'featured',
        source: 'controlled',
        class: featuredGrid,
        bind: { items: `${GALLERY_PROVIDER}.featured` },
        children: [card('featured', frame('featuredFrame', '280px'), true)]
      })
    ]
  });

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

const searchBox = styles('searchBox', {
  css: {
    display: 'flex',
    'align-items': 'center',
    height: '38px',
    padding: '0px 12px',
    border: '1px solid var(--edge)',
    'border-radius': '10px',
    'background-color': 'var(--surface)'
  },
  states: { 'focus-within': { 'border-color': 'var(--accent)' } }
});

const searchField = styles('searchField', { width: '240px' });

const empty = styles('emptyBoards', {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '6px',
  padding: '40px 24px',
  'border-radius': '16px',
  border: '2px dashed var(--edge)',
  'text-align': 'center',
  color: 'var(--muted)'
});

const emptyTitle = styles('emptyTitle', { 'font-family': 'var(--hand)', 'font-size': '26px', color: 'var(--ink)' });

/** The boards whose names contain what was searched — all of them while nothing is. */
const MATCHING = "source|filter(board => (state.search ?? '')|trim|lower in board.title|lower)";

export const recent = (): ElementSpec =>
  container({
    class: sectionBlock,
    children: [
      container({
        class: blockHead,
        children: [
          sectionHead({
            tone: 'sky',
            eyebrow: 'Right now',
            title: 'Boards drawn lately',
            lead: text({
              content: '',
              class: sectionLead,
              bind: [
                bindTemplate(
                  'content',
                  `${GALLERY_PROVIDER}.boards`,
                  "{{ source|length }} {{ (source|length) == 1 ? 'board' : 'boards' }} — updated live as people draw"
                )
              ]
            })
          }),
          formControl({
            id: 'search',
            name: 'search',
            label: '',
            placeholder: 'Search boards by name',
            required: false,
            autoComplete: false,
            class: searchField,
            slots: { input: searchBox },
            flows: [
              [named('typed', on('onChange')), setState({ key: 'search', type: 'text', value: '{{ typed.value }}' })]
            ]
          })
        ]
      }),
      list({
        id: 'boards',
        source: 'controlled',
        class: grid,
        bind: [bindTemplate('items', `${GALLERY_PROVIDER}.boards`, `{{ ${MATCHING} }}`, { returns: 'value' })],
        children: [card('boards', frame('thumbFrame', '160px'), false)]
      }),
      container({
        id: 'no-boards',
        class: empty,
        visible: {
          source: `${GALLERY_PROVIDER}.boards`,
          template: `{{ (${MATCHING})|length == 0 }}`
        },
        children: [
          text({ content: 'Nothing here yet', class: emptyTitle }),
          text({ content: 'Start a board above — or search for another name.' })
        ]
      })
    ]
  });
