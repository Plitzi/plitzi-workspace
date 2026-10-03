import type { InteractionCallback } from '@plitzi/sdk-shared';

export const interactionBasicTriggers: Record<string, InteractionCallback> = {
  onLoad: {
    action: 'onLoad',
    title: 'On Load',
    type: 'trigger',
    preview: {},
    params: {}
  },
  onClick: {
    action: 'onClick',
    title: 'On Click',
    type: 'trigger',
    preview: { propagateEvent: '' },
    params: { propagateEvent: { canBind: false, defaultValue: false, type: 'boolean', label: 'Propagate Event' } }
  },
  /**
   * The press itself, before it is a click: where something dragged away from the element starts — a tile taken to a
   * canvas, a handle pulled. Let go where it went down, it is a click as well, and `onClick` fires after it.
   */
  onPointerDown: {
    action: 'onPointerDown',
    title: 'On Pointer Down',
    type: 'trigger',
    preview: { propagateEvent: '' },
    params: { propagateEvent: { canBind: false, defaultValue: false, type: 'boolean', label: 'Propagate Event' } }
  },
  onMouseEnter: {
    action: 'onMouseEnter',
    title: 'On Mouse Enter',
    type: 'trigger',
    preview: { propagateEvent: '' },
    params: { propagateEvent: { canBind: false, defaultValue: false, type: 'boolean', label: 'Propagate Event' } }
  },
  onMouseLeave: {
    action: 'onMouseLeave',
    title: 'On Mouse Leave',
    type: 'trigger',
    preview: { propagateEvent: '' },
    params: { propagateEvent: { canBind: false, defaultValue: false, type: 'boolean', label: 'Propagate Event' } }
  },
  onHover: {
    action: 'onHover',
    title: 'On Hover',
    type: 'trigger',
    preview: { propagateEvent: '' },
    params: { propagateEvent: { canBind: false, defaultValue: false, type: 'boolean', label: 'Propagate Event' } }
  },
  onFocus: {
    action: 'onFocus',
    title: 'On Focus',
    type: 'trigger',
    preview: { propagateEvent: '' },
    params: { propagateEvent: { canBind: false, defaultValue: false, type: 'boolean', label: 'Propagate Event' } }
  },
  onBlur: {
    action: 'onBlur',
    title: 'On Blur',
    type: 'trigger',
    preview: { propagateEvent: '' },
    params: { propagateEvent: { canBind: false, defaultValue: false, type: 'boolean', label: 'Propagate Event' } }
  },
  /**
   * Every so often while the element is on the page and the tab is in view: an autoplay, a clock, a refresh. Each flow
   * names its own interval; the ticks it has counted travel with it.
   */
  onInterval: {
    action: 'onInterval',
    title: 'On Interval',
    type: 'trigger',
    preview: { interval: '', count: '' },
    params: {
      interval: { canBind: false, defaultValue: '5000', type: 'text', label: 'Every (milliseconds, at least 250)' }
    }
  },
  /**
   * A keyboard shortcut, heard while the element is on the page — on the page itself, the whole page's.
   *
   * Not a DOM event of the element: it listens on the window, so the element need not have focus, and it is ignored
   * while somebody types in a field unless Ctrl, ⌘ or Alt is held, or the key is Escape — and the field keeps its own
   * editing even then (⌘A, ⌘Z, ⌘C/⌘V, moving by word). `keys` is one shortcut or several with commas — `'f'`, `'shift+f'`, `'mod+k'` (⌘ on a Mac, Ctrl elsewhere), `'escape, q'`.
   */
  onKey: {
    action: 'onKey',
    title: 'On Key',
    type: 'trigger',
    preview: { key: '', shortcuts: '' },
    params: {
      keys: {
        canBind: false,
        defaultValue: '',
        type: 'text',
        label: 'Keys (e.g. f, shift+f, mod+k, escape)'
      }
    }
  },
  /**
   * The element's own box scrolled — a row of cards swiped, a panel read to the end. At most once a frame, and once
   * when it mounts, so a flow can hide the arrow at the end that is already reached.
   */
  onScroll: {
    action: 'onScroll',
    title: 'On Scroll',
    type: 'trigger',
    preview: { x: '', y: '', atStart: '', atEnd: '' },
    params: {}
  },
  /**
   * The end of a server action this element started.
   *
   * Not a DOM event — nothing in `nativeEventsList` — so it is never wired to the element's markup: the actions
   * source fires it on whichever element launched the run. It exists because a `detached` step returns the moment
   * the server accepts the work, which leaves the page with nothing to react to when it actually finishes.
   *
   * `actionId` is a param so one element can launch several actions and each trigger filters with its own `when`.
   */
  onFlowEnd: {
    action: 'onFlowEnd',
    title: 'On Server Action End',
    type: 'trigger',
    preview: { actionId: '', runId: '', status: '', output: {} },
    params: {}
  },
  /** A run that failed, or that the server refused — `reason` carries its own word for why (`duplicate`,
   *  `over_capacity`, `recursion`, `forbidden`…), so a flow can tell "I clicked twice" from "this is broken". */
  onFlowError: {
    action: 'onFlowError',
    title: 'On Server Action Error',
    type: 'trigger',
    preview: { actionId: '', runId: '', error: '', reason: '' },
    params: {}
  },
  /** A streaming run reporting as it goes. Fires once per chunk the flow emitted, which is what a progress bar or
   *  a token-by-token answer is built from — the run is still going when this arrives. */
  onFlowProgress: {
    action: 'onFlowProgress',
    title: 'On Server Action Progress',
    type: 'trigger',
    preview: { actionId: '', runId: '', chunk: '' },
    params: {}
  }
};

export const nativeEventsList = [
  'onClick',
  'onPointerDown',
  'onHover',
  'onFocus',
  'onBlur',
  'onMouseEnter',
  'onMouseLeave'
];
