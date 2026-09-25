import { button, container, onClick, styles } from '@plitzi/sdk-authoring';

import { BUTTON_RESET, PANEL } from './kit.ts';
import { mapAction } from './map.ts';

import type { ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * The camera, by button: zoom, pan and back to the whole view.
 *
 * For whoever is not holding a mouse — a trackpad with no scroll gesture, a keyboard, a presenter's clicker, a touch
 * screen on a wall. Each button is an ordinary element whose flow calls one of the map's declared actions; the map
 * decides how far a step goes, and each press pauses the globe's idle rotation like a drag would.
 */

const navPanel = styles('navPanel', {
  css: { desktop: { ...PANEL, gap: '6px', padding: '8px' }, mobile: { display: 'none' } }
});

/** Zoom out and in, side by side: the pair a reader reaches for most, in the order the numbers go. */
const zoomRow = styles('zoomRow', { display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '4px' });

/** The cross: north, west, home, east, south — a direction per arm, the whole view in the middle. */
const pad = styles('pad', {
  display: 'grid',
  'grid-template-columns': 'repeat(3, 30px)',
  'grid-auto-rows': '30px',
  gap: '4px'
});

const navButton = styles('navButton', {
  css: {
    ...BUTTON_RESET,
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    height: '30px',
    padding: '0px',
    'font-family': 'var(--mono)',
    'font-size': '15px',
    'font-weight': '700',
    'line-height': '1',
    color: 'var(--trace)',
    'background-color': 'var(--cell)',
    border: '1px solid var(--edge-soft)',
    transition: 'background-color 120ms linear, border-color 120ms linear'
  },
  states: {
    hover: { 'border-color': 'var(--trace)', 'background-color': 'var(--edge-soft)' },
    active: { 'background-color': 'var(--trace)', color: 'var(--void)' },
    'focus-visible': { outline: '1px solid var(--trace)', 'outline-offset': '2px' }
  }
});

/** An empty cell, so the pad keeps its cross shape without a button in its corners. */
const navGap = styles('navGap', { 'pointer-events': 'none' });

const control = (id: string, content: string, hint: string, step: StepSpec): ElementSpec =>
  button({ id: `nav-${id}`, content, title: hint, class: navButton, flows: [[onClick(), step]] });

const gap = (): ElementSpec => container({ class: navGap });

export const nav = (): ElementSpec =>
  container({
    id: 'nav',
    class: navPanel,
    children: [
      container({
        class: zoomRow,
        children: [
          control('zoom-out', '−', 'Zoom out', mapAction('zoomOut')),
          control('zoom-in', '+', 'Zoom in', mapAction('zoomIn'))
        ]
      }),
      container({
        class: pad,
        children: [
          gap(),
          control('north', '▲', 'Pan north', mapAction('pan', { direction: 'north' })),
          gap(),
          control('west', '◀', 'Pan west', mapAction('pan', { direction: 'west' })),
          control('home', '⌂', 'Back to the whole view', mapAction('resetView')),
          control('east', '▶', 'Pan east', mapAction('pan', { direction: 'east' })),
          gap(),
          control('south', '▼', 'Pan south', mapAction('pan', { direction: 'south' })),
          gap()
        ]
      })
    ]
  });
