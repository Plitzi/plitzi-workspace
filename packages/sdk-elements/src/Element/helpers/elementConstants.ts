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
  }
};

export const nativeEventsList = ['onClick', 'onHover', 'onFocus', 'onBlur', 'onMouseEnter', 'onMouseLeave'];
