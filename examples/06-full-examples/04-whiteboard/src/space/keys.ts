import { button, container, onClick, onKey, setState, styles, text, toggleState } from '@plitzi/sdk-authoring';

import { useTool } from './elements.ts';
import { FLOAT, ICON_BUTTON, caption } from './kit.ts';
import { closeOthers, closePanels } from './panels.ts';
import { boardAction } from './stylePanel.ts';
import { KEYED, toolKeys } from './toolbar.ts';

import type { ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * The keyboard: every tool and every action on the board, as ordinary flows on the page. `onKey` is a trigger like
 * `onClick`, so what a key does is written once, beside what the button for it does, and this list is the whole of it.
 *
 * A press while somebody types — the title, their name, a sticky — is the field's, unless ⌘/Ctrl is held; the
 * canvas itself ignores ⌘Z while its own text field has the focus, where it is the field's undo.
 */

export const shortcuts: StepSpec[][] = [
  ...toolKeys,
  [onKey('delete, backspace'), boardAction('deleteSelection')],
  [onKey('mod+z'), boardAction('undo')],
  [onKey('mod+shift+z, mod+y'), boardAction('redo')],
  [onKey('mod+a'), boardAction('selectAll')],
  [onKey('mod+d'), boardAction('duplicate')],
  [onKey('mod+g'), boardAction('group')],
  [onKey('mod+shift+g'), boardAction('ungroup')],
  [onKey('mod+shift+l'), boardAction('toggleLock')],
  [onKey(']'), boardAction('bringToFront')],
  [onKey('['), boardAction('sendToBack')],
  [onKey('mod+]'), boardAction('bringForward')],
  [onKey('mod+['), boardAction('sendBackward')],
  // The arrows nudge the selection — ten at a time with Shift — and, while presenting, go from frame to frame.
  ...(['left', 'right', 'up', 'down'] as const).flatMap(direction => [
    [onKey(direction), boardAction('step', { direction })],
    [onKey(`shift+${direction}`), boardAction('step', { direction, far: true })]
  ]),
  [onKey('plus, ='), boardAction('zoomIn')],
  [onKey('minus'), boardAction('zoomOut')],
  [onKey('shift+f'), boardAction('zoomToFit')],
  [onKey('mod+0'), boardAction('zoomReset')],
  [onKey('mod+shift+e'), boardAction('exportPng')],
  // Cursor chat: say something where you point, for everyone on the board.
  [onKey('/'), boardAction('chat')],
  [onKey('shift+v'), boardAction('vote')],
  [onKey('i'), ...closeOthers('libraryOpen'), toggleState({ key: 'libraryOpen' })],
  [onKey('?'), setState({ key: 'shareOpen', type: 'boolean', value: false }), toggleState({ key: 'keysOpen' })],
  [
    onKey('escape'),
    ...closePanels,
    boardAction('stopPresenting'),
    boardAction('deselect'),
    boardAction('unfollow'),
    useTool('select')
  ]
];

/** What the help lists: the keys as a person reads them. */
const KEYS: readonly { keys: string[]; does: string }[] = [
  ...KEYED.map(entry => ({
    keys: entry.keys.split(', ').map(key => key.toUpperCase()),
    does: entry.label.split(' — ')[0]
  })),
  { keys: ['I'], does: 'All elements' },
  { keys: ['Space', 'drag'], does: 'Pan' },
  { keys: ['⌘', 'scroll'], does: 'Zoom' },
  { keys: ['+', '−'], does: 'Zoom in · out' },
  { keys: ['⇧', 'F'], does: 'Zoom to fit' },
  { keys: ['⌘', '0'], does: 'Zoom to 100%' },
  { keys: ['⌘', 'Z'], does: 'Undo' },
  { keys: ['⌘', '⇧', 'Z'], does: 'Redo' },
  { keys: ['⌘', 'D'], does: 'Duplicate' },
  { keys: ['⌘', 'G'], does: 'Group' },
  { keys: ['⌘', '⇧', 'G'], does: 'Ungroup' },
  { keys: ['⌘', '⇧', 'L'], does: 'Lock in place · unlock' },
  { keys: ['double-click'], does: 'Into a group · edit text · label a shape' },
  { keys: ['drag', '●'], does: 'Connect from a shape’s point' },
  { keys: ['⌘', 'A'], does: 'Select all' },
  { keys: ['[', ']'], does: 'Send to back · bring to front' },
  { keys: ['⌘', '[', ']'], does: 'Send backward · bring forward' },
  { keys: ['←', '→', '↑', '↓'], does: 'Nudge — ⇧ ten · next frame when presenting' },
  { keys: ['click', '●'], does: 'Add one like it, connected' },
  { keys: ['⌘', 'C', 'V'], does: 'Copy · paste — between boards too' },
  { keys: ['⌫'], does: 'Delete' },
  { keys: ['⇧', 'drag'], does: 'Square · straight · keep ratio' },
  { keys: ['⌘', '⇧', 'E'], does: 'Export PNG' },
  { keys: ['/'], does: 'Say something at your cursor' },
  { keys: ['⇧', 'V'], does: 'Vote for the selection' },
  { keys: ['⌘', 'V'], does: 'Paste a picture · text as a note' },
  { keys: ['Esc'], does: 'Deselect · stop following · close' }
];

const keysPanel = styles('keysPanel', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      'z-index': '9',
      width: '520px',
      'max-height': 'calc(100dvh - 48px)',
      'overflow-y': 'auto',
      padding: '18px 20px',
      display: 'flex',
      'flex-direction': 'column',
      gap: '12px'
    },
    mobile: { width: 'calc(100vw - 24px)' }
  }
});

const keysBackdrop = styles('keysBackdrop', {
  position: 'absolute',
  inset: '0px',
  'z-index': '8',
  'pointer-events': 'auto',
  'background-color': 'color-mix(in srgb, var(--paper) 55%, transparent)'
});

const keysHead = styles('keysHead', {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between'
});

const keysTitle = styles('keysTitle', { 'font-size': '15px', 'font-weight': '600' });

const keyGrid = styles('keyGrid', {
  css: {
    desktop: {
      display: 'grid',
      'grid-template-columns': 'repeat(2, minmax(0px, 1fr))',
      gap: '8px 20px'
    },
    mobile: { 'grid-template-columns': 'minmax(0px, 1fr)' }
  }
});

const keyRow = styles('keyRow', {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '10px',
  'min-width': '0px'
});

const keyCaps = styles('keyCaps', { display: 'flex', gap: '3px', 'flex-shrink': '0' });

const keyCap = styles('keyCap', {
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  'min-width': '22px',
  height: '22px',
  padding: '0px 6px',
  'border-radius': '6px',
  'font-size': '11px',
  'font-weight': '600',
  color: 'var(--ink)',
  'background-color': 'var(--surface-2)',
  'border-bottom': '2px solid var(--edge)'
});

const keyDoes = styles('keyDoes', { 'font-size': '13px', color: 'var(--ink)' });

const closeButton = styles('keysClose', {
  css: { ...ICON_BUTTON, width: '28px', height: '28px', color: 'var(--muted)' },
  states: { hover: { color: 'var(--ink)', 'background-color': 'var(--surface-2)' } }
});

const closeKeys = setState({ key: 'keysOpen', type: 'boolean', value: false });

/** The shortcuts, listed — opened with `?` or the button in the corner, closed by any click outside or Escape. */
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
      container({
        class: keysHead,
        children: [
          text({ content: 'Keyboard', class: keysTitle }),
          button({
            id: 'keys-close',
            content: '✕',
            title: 'Close',
            class: closeButton,
            flows: [[onClick(), closeKeys]]
          })
        ]
      }),
      container({
        class: keyGrid,
        children: KEYS.map(entry =>
          container({
            class: keyRow,
            children: [
              text({ content: entry.does, class: keyDoes }),
              container({ class: keyCaps, children: entry.keys.map(key => text({ content: key, class: keyCap })) })
            ]
          })
        )
      }),
      text({ content: 'Keys are ignored while you type — except ⌘ shortcuts', class: caption })
    ]
  })
];
