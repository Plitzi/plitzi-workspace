import type { BoardProps } from './Board';
import type { PluginDeclaration } from '@plitzi/plitzi-sdk';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type BoardAttributes = Omit<BoardProps, 'className'>;

const callback = (action: string, title: string) => ({ action, title, type: 'callback', params: {} }) as const;

/**
 * The canvas, as data: its events, the actions it answers to, and its defaults.
 *
 * Imported by the component, which registers exactly these, and by `src/space`, which authors the element from the
 * same object. No React in here: the space is authored in Node.
 *
 * The canvas decides nothing about the board. It draws, it takes a pointer, and it SAYS what happened — a commit, a
 * tool it switched to, a selection — while the flows around it decide what that means: `onCommit` is sent to a server
 * action, the tool is the page's state, the palette follows the selection. That is why the toolbar, the palette and
 * the keyboard are authored in the space and the canvas holds none of them.
 */
const declaration = {
  type: 'board',
  triggers: {
    /** Elements changed by this person, ready to keep: each one whole, its version already raised. */
    onCommit: { action: 'onCommit', title: 'On Commit', type: 'trigger', params: {}, preview: { ops: '', count: '' } },
    /** The canvas moved to another tool by itself — back to select after a shape, to text after a sticky. */
    onToolChange: {
      action: 'onToolChange',
      title: 'On Tool Change',
      type: 'trigger',
      params: {},
      preview: { tool: '' }
    },
    /** What is selected now, with the style it shares (`''` where the selection disagrees). */
    onSelectionChange: {
      action: 'onSelectionChange',
      title: 'On Selection Change',
      type: 'trigger',
      params: {},
      preview: { count: '', stroke: '', fill: '', strokeWidth: '' }
    },
    onViewChange: {
      action: 'onViewChange',
      title: 'On View Change',
      type: 'trigger',
      params: {},
      preview: { zoom: '' }
    },
    /**
     * The board's channel came back after a drop: what was said meanwhile was missed, and the page should read the
     * board again. The canvas merges whatever it is given — it only knows it may have missed something.
     */
    onResync: { action: 'onResync', title: 'On Resync', type: 'trigger', params: {}, preview: {} }
  },
  callbacks: {
    undo: callback('undo', 'Undo'),
    redo: callback('redo', 'Redo'),
    deleteSelection: callback('deleteSelection', 'Delete Selection'),
    selectAll: callback('selectAll', 'Select All'),
    duplicate: callback('duplicate', 'Duplicate'),
    deselect: callback('deselect', 'Deselect'),
    bringToFront: callback('bringToFront', 'Bring To Front'),
    sendToBack: callback('sendToBack', 'Send To Back'),
    /** Restyles the selection. Only the params given change: a colour picked leaves the width alone. */
    applyStyle: {
      action: 'applyStyle',
      title: 'Apply Style',
      type: 'callback',
      params: {
        stroke: { label: 'Stroke colour', defaultValue: '', type: 'text' },
        fill: { label: 'Fill colour', defaultValue: '', type: 'text' },
        strokeWidth: { label: 'Stroke width (1 | 2 | 4)', defaultValue: '', type: 'text' }
      }
    },
    zoomIn: callback('zoomIn', 'Zoom In'),
    zoomOut: callback('zoomOut', 'Zoom Out'),
    zoomReset: callback('zoomReset', 'Zoom To 100%'),
    zoomToFit: callback('zoomToFit', 'Zoom To Fit'),
    exportPng: callback('exportPng', 'Export PNG'),
    /**
     * The server refused a commit: drop every edit it has not confirmed and draw what it holds. What was refused is
     * gone from this screen, as it never reached any other.
     */
    rollback: callback('rollback', 'Roll Back Unconfirmed')
  },
  content: {
    attributes: {
      boardId: '',
      topic: '',
      roomTopic: '',
      title: '',
      mode: 'edit',
      tool: 'select',
      stroke: 'ink',
      fill: 'none',
      strokeWidth: 2,
      scheme: 'light'
    },
    definition: {
      label: 'Board',
      type: 'board',
      description:
        'An infinite whiteboard in a hand-drawn stroke: pan, zoom, shapes, arrows, lines, freehand, text and sticky ' +
        'notes. Bind `elements` to the board as the server keeps it; `topic` is the channel the server announces ' +
        'saved elements on and `roomTopic` the one cursors and live drags travel on. It fires `onCommit` with the ' +
        'changed elements for the page to keep, and `onToolChange`, `onSelectionChange`, `onViewChange` and ' +
        '`onResync`. `mode: view` draws a still preview. Colours come from the `--board-*` custom properties.',
      items: [],
      bindings: {},
      styleSelectors: { base: '' },
      initialState: { visibility: true }
    },
    builder: {
      canDelete: true,
      canSelect: true,
      canDragDrop: true,
      canMove: true,
      canTemplate: true,
      itemsAllowed: [],
      itemsNotAllowed: []
    },
    market: {
      category: 'Canvas',
      owner: 'Plitzi examples',
      license: 'MIT',
      website: '',
      backgroundColor: '#f6f1e7',
      icon: 'fa-solid fa-chalkboard'
    },
    defaultStyle: {
      name: 'Board',
      displayMode: 'desktop',
      style: { base: { default: {} } },
      bindingsAllowed: {
        attributes: [
          { path: 'boardId', label: 'Board id' },
          { path: 'elements', label: 'Elements' },
          { path: 'topic', label: 'Board topic' },
          { path: 'roomTopic', label: 'Room topic' },
          { path: 'title', label: 'Title (the exported file’s name)' },
          { path: 'mode', label: 'Mode (edit | view)' },
          { path: 'tool', label: 'Tool' },
          { path: 'stroke', label: 'Stroke colour' },
          { path: 'fill', label: 'Fill colour' },
          { path: 'strokeWidth', label: 'Stroke width' },
          { path: 'scheme', label: 'Colour scheme' }
        ],
        initialState: []
      }
    },
    settings: {}
  }
} satisfies PluginDeclaration<BoardAttributes>;

export default declaration;
