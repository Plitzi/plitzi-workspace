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
  }
};

export const nativeEventsList = ['onClick', 'onHover', 'onFocus', 'onBlur', 'onMouseEnter', 'onMouseLeave'];
