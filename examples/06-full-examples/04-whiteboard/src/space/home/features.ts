import { container, heading, styles, text } from '@plitzi/sdk-authoring';

import { icon } from '../kit.ts';

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

const block = styles('featuresBlock', { display: 'flex', 'flex-direction': 'column', gap: '18px' });

const blockTitle = styles('featuresTitle', {
  margin: '0px',
  'font-family': 'var(--hand)',
  'font-size': '32px',
  'font-weight': '700',
  'line-height': '1.1'
});

const blockLead = styles('featuresLead', { margin: '4px 0px 0px', 'font-size': '14px', color: 'var(--muted)' });

const grid = styles('featuresGrid', {
  css: {
    desktop: { display: 'grid', 'grid-template-columns': 'repeat(4, minmax(0px, 1fr))', gap: '12px' },
    tablet: { 'grid-template-columns': 'repeat(2, minmax(0px, 1fr))' },
    mobile: { 'grid-template-columns': 'minmax(0px, 1fr)' }
  }
});

const item = styles('featureItem', {
  css: {
    display: 'flex',
    'flex-direction': 'column',
    gap: '6px',
    padding: '16px',
    'border-radius': '14px',
    border: '1px solid var(--edge)',
    'background-color': 'var(--surface)',
    transition: 'border-color 160ms ease, transform 160ms ease'
  },
  states: { hover: { 'border-color': 'var(--accent)', transform: 'translateY(-2px)' } }
});

const mark = styles('featureMark', {
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '34px',
  height: '34px',
  'border-radius': '10px',
  'font-size': '15px',
  color: 'var(--accent)',
  'background-color': 'var(--accent-soft)'
});

const title = styles('featureTitle', { 'font-weight': '600', 'font-size': '15px' });

const line = styles('featureLine', { 'font-size': '13px', 'line-height': '1.45', color: 'var(--muted)' });

export const features = (): ElementSpec =>
  container({
    class: block,
    children: [
      container({
        children: [
          heading({ content: 'Everything on one board', subType: 'h2', class: blockTitle }),
          text({ content: 'No plan to pick, no account to make: every board has all of it.', class: blockLead })
        ]
      }),
      container({
        class: grid,
        children: FEATURES.map(feature =>
          container({
            class: item,
            children: [
              container({ class: mark, children: [icon(feature.glyph)] }),
              text({ content: feature.title, class: title }),
              text({ content: feature.line, class: line })
            ]
          })
        )
      })
    ]
  });
