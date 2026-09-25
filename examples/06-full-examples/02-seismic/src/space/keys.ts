import {
  button,
  container,
  declaredCallback,
  onClick,
  onKey,
  setState,
  styles,
  text,
  toggleState,
  when
} from '@plitzi/sdk-authoring';

import fullscreenDeclaration from '../plugins/FullscreenToggle/declaration.ts';
import { FULLSCREEN_ID } from './ids.ts';
import { BUTTON_RESET, PANEL, caption, heading } from './kit.ts';
import { mapAction, releaseLock, resetMapView } from './map.ts';

import type { ElementSpec, Rule, StepSpec } from '@plitzi/sdk-authoring';

/**
 * The keyboard: every control on the display, for a presenter with a clicker, a TV remote's arrows, or anybody who
 * would rather not reach for the mouse.
 *
 * Each shortcut is an ordinary flow on the HUD — `onKey` is a trigger like `onClick` — so what a key does is written
 * once, beside what the button for it does, and the list below is the whole of it.
 */

/** Nothing is open on top of the display: Escape then means "let go", not "close". */
const nothingOpen: Rule[] = [
  { field: 'state.settingsOpen', operator: '!=', value: true },
  { field: 'state.keysOpen', operator: '!=', value: true }
];

/**
 * Escape, in the order a person means it: close what is open; if nothing is, let go of the lock, go home, stop what
 * is running. Each step reads the page as it runs, so the ones that let go come FIRST — after the panels are closed,
 * "nothing is open" would always hold.
 */
const escape: StepSpec[] = [
  onKey('escape'),
  ...[
    ...releaseLock(),
    setState({ key: 'tour', type: 'boolean', value: false }),
    setState({ key: 'replay', type: 'boolean', value: false })
  ].map(step => when(nothingOpen, step)),
  setState({ key: 'settingsOpen', type: 'boolean', value: false }),
  setState({ key: 'keysOpen', type: 'boolean', value: false })
];

export const shortcuts: StepSpec[][] = [
  [onKey('plus, ='), mapAction('zoomIn')],
  [onKey('minus'), mapAction('zoomOut')],
  [onKey('up'), mapAction('pan', { direction: 'north' })],
  [onKey('down'), mapAction('pan', { direction: 'south' })],
  [onKey('left'), mapAction('pan', { direction: 'west' })],
  [onKey('right'), mapAction('pan', { direction: 'east' })],
  [onKey('h, 0'), resetMapView()],
  [
    onKey('g'),
    setState({ key: 'projection', type: 'text', value: "{{ computed.projection == 'globe' ? 'flat' : 'globe' }}" })
  ],
  [onKey('t'), setState({ key: 'replay', type: 'boolean', value: false }), toggleState({ key: 'tour' })],
  [
    onKey('r'),
    setState({ key: 'tour', type: 'boolean', value: false }),
    setState({ key: 'selectedId', type: 'text', value: '' }),
    resetMapView(),
    toggleState({ key: 'replay' })
  ],
  [onKey('f'), declaredCallback(fullscreenDeclaration, 'toggle', { on: FULLSCREEN_ID })],
  [onKey('s'), setState({ key: 'keysOpen', type: 'boolean', value: false }), toggleState({ key: 'settingsOpen' })],
  [onKey('m'), toggleState({ key: 'soundOff' })],
  [onKey('?'), setState({ key: 'settingsOpen', type: 'boolean', value: false }), toggleState({ key: 'keysOpen' })],
  escape
];

/** What the help lists: the keys as a person reads them, and what they do. */
const KEYS: readonly { keys: string[]; does: string }[] = [
  { keys: ['+', '−'], does: 'Zoom in · out' },
  { keys: ['←', '↑', '→', '↓'], does: 'Pan' },
  { keys: ['H'], does: 'Home' },
  { keys: ['G'], does: 'Globe · flat' },
  { keys: ['T'], does: 'Tour the strongest' },
  { keys: ['R'], does: 'Replay the window' },
  { keys: ['F'], does: 'Full screen' },
  { keys: ['S'], does: 'Settings' },
  { keys: ['M'], does: 'Sound on · off' },
  { keys: ['?'], does: 'This list' },
  { keys: ['Esc'], does: 'Close · let go · stop' }
];

const keysPanel = styles('keysPanel', {
  css: {
    desktop: {
      ...PANEL,
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '380px',
      gap: '10px',
      'z-index': '9',
      'pointer-events': 'auto',
      'background-color': 'var(--panel-strong)',
      border: '1px solid var(--trace)',
      'box-shadow': '0 24px 60px -24px var(--trace-glow)'
    },
    mobile: { width: 'calc(100vw - 32px)' }
  }
});

const keysBackdrop = styles('keysBackdrop', {
  position: 'absolute',
  inset: '0px',
  'z-index': '8',
  'pointer-events': 'auto',
  'background-color': 'color-mix(in srgb, var(--void) 45%, transparent)'
});

const keyList = styles('keyList', {
  display: 'grid',
  'grid-template-columns': 'auto minmax(0, 1fr)',
  'align-items': 'center',
  gap: '8px 16px'
});

const keyCaps = styles('keyCaps', { display: 'flex', gap: '4px' });

const keyCap = styles('keyCap', {
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  'min-width': '22px',
  height: '22px',
  padding: '0px 6px',
  'font-family': 'var(--mono)',
  'font-size': '11px',
  'font-weight': '700',
  color: 'var(--trace)',
  border: '1px solid var(--edge)',
  'border-bottom-width': '2px',
  'background-color': 'var(--cell)'
});

const keyDoes = styles('keyDoes', {
  'font-family': 'var(--mono)',
  'font-size': '11px',
  'letter-spacing': '0.08em',
  'text-transform': 'uppercase',
  color: 'var(--ink)'
});

const keysClose = styles('keysClose', {
  css: {
    ...BUTTON_RESET,
    padding: '0px 4px',
    border: '0px solid transparent',
    'background-color': 'transparent',
    color: 'var(--dim)',
    'font-size': '14px'
  },
  states: { hover: { color: 'var(--trace)' }, 'focus-visible': { outline: '1px solid var(--trace)' } }
});

const closeKeys = setState({ key: 'keysOpen', type: 'boolean', value: false });

/** The shortcuts, listed — opened with `?` or from the settings panel, closed by any click outside or Escape. */
export const keysHelp = (): ElementSpec[] => [
  container({
    id: 'keys-backdrop',
    class: keysBackdrop,
    visible: 'computed.keysOpen',
    flows: [[onClick(), closeKeys]]
  }),
  container({
    id: 'keys',
    class: keysPanel,
    visible: 'computed.keysOpen',
    children: [
      heading(
        'Keyboard',
        button({ id: 'keys-close', content: '✕', title: 'Close', class: keysClose, flows: [[onClick(), closeKeys]] })
      ),
      container({
        class: keyList,
        children: KEYS.flatMap(entry => [
          container({ class: keyCaps, children: entry.keys.map(key => text({ content: key, class: keyCap })) }),
          text({ content: entry.does, class: keyDoes })
        ])
      }),
      text({ content: 'Keys are ignored while you type in a field', class: caption })
    ]
  })
];
