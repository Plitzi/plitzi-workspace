import { container, styles, text } from '@plitzi/sdk-authoring';

import { icon } from '../kit.ts';
import { cardLine, cardName, HOME_CARD, HOME_CARD_STATES, sectionBlock, sectionHead } from './section.ts';

import type { CollabColour } from '../../board/people.ts';
import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * Everything a board holds, at a glance: what a visitor would otherwise find one button at a time. Each entry is the
 * feature and one line of what it is for — nothing here is a promise the board does not keep.
 */

const FEATURES: readonly { glyph: string; title: string; line: string }[] = [
  {
    glyph: 'fa-solid fa-table-columns',
    title: 'Frames and kanban',
    line: 'Sections that hold what is put in them; columns that sort their cards as they are dropped.'
  },
  {
    glyph: 'fa-regular fa-square-check',
    title: 'Cards and comments',
    line: 'Tasks with a done box and who wrote them; feedback pinned to a place, with a thread to answer in.'
  },
  {
    glyph: 'fa-solid fa-robot',
    title: 'AI agents',
    line: 'Invite an agent: it joins by name, with a cursor, reads the board, adds to it and talks in the chat.'
  },
  {
    glyph: 'fa-regular fa-comments',
    title: 'Chat and sounds',
    line: 'A chat that stays with the board, and soft sounds for what happens on it — a timer, a vote, a reaction.'
  },
  {
    glyph: 'fa-solid fa-sliders',
    title: 'Styles like Excalidraw',
    line: 'Stroke and background, hachure or solid, dashed or dotted, sloppiness, round edges, opacity, layers.'
  },
  {
    glyph: 'fa-solid fa-paintbrush',
    title: 'Eight brushes',
    line: 'Our own ink, a Japanese brush, a fountain pen, a marker, a highlighter, pencil, chalk and neon.'
  },
  {
    glyph: 'fa-solid fa-shapes',
    title: 'Diagrams that hold together',
    line: 'Rectangles to stars and databases; arrows fixed to what they connect; click a point to grow the next one.'
  },
  {
    glyph: 'fa-solid fa-display',
    title: 'Present and follow',
    line: 'Take everyone through the frames one by one, follow someone’s view, or bring the whole board to yours.'
  },
  {
    glyph: 'fa-regular fa-map',
    title: 'Minimap',
    line: 'The whole board in a corner, with where everyone is looking — a click takes you there.'
  },
  {
    glyph: 'fa-regular fa-eye-slash',
    title: 'Private and temporary',
    line: 'Keep a board off the front page, lock it with a password, or let it disappear after a day.'
  },
  {
    glyph: 'fa-regular fa-copy',
    title: 'Templates, copy and paste',
    line: 'Start from a kanban, a retro, a roadmap or a mind map — and paste elements from one board to another.'
  },
  {
    glyph: 'fa-solid fa-server',
    title: 'Runs on replicas',
    line: 'One process, or many behind a balancer over Redis: people on different servers still draw together.'
  }
];

const grid = styles('featuresGrid', {
  css: {
    desktop: { display: 'grid', 'grid-template-columns': 'repeat(4, minmax(0px, 1fr))', gap: '12px' },
    tablet: { 'grid-template-columns': 'repeat(2, minmax(0px, 1fr))' },
    mobile: { 'grid-template-columns': 'minmax(0px, 1fr)' }
  }
});

const item = styles('featureItem', {
  css: { ...HOME_CARD, gap: '8px', padding: '18px' },
  states: HOME_CARD_STATES
});

/** The colours the features' marks go round, so a grid of twelve reads as twelve things. */
const TONES: readonly CollabColour[] = ['indigo', 'teal', 'orchid', 'amber', 'sky', 'rose', 'lime', 'coral'];

/** A feature's mark: its icon on a tile of its colour. */
const markIn = (tone: CollabColour) =>
  styles(`featureMark-${tone}`, {
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: '38px',
    height: '38px',
    'margin-bottom': '4px',
    'border-radius': '11px',
    'font-size': '16px',
    color: `var(--collab-${tone})`,
    'background-color': `color-mix(in srgb, var(--collab-${tone}) 14%, transparent)`
  });

export const features = (): ElementSpec =>
  container({
    class: sectionBlock,
    children: [
      sectionHead({
        tone: 'teal',
        eyebrow: 'Features',
        title: 'Everything on one board',
        lead: 'No plan to pick, no account to make: every board has all of it.'
      }),
      container({
        class: grid,
        children: FEATURES.map((feature, index) =>
          container({
            class: item,
            children: [
              container({ class: markIn(TONES[index % TONES.length]), children: [icon(feature.glyph)] }),
              text({ content: feature.title, class: cardName }),
              text({ content: feature.line, class: cardLine })
            ]
          })
        )
      })
    ]
  });
