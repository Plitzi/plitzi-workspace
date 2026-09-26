import type { CountdownProps } from './Countdown';
import type { PluginDeclaration } from '@plitzi/plitzi-sdk';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type CountdownAttributes = Omit<CountdownProps, 'className'>;

/**
 * The time left until a moment, ticking: what a board's shared timer shows everyone.
 *
 * An element because a clock is what a binding cannot be — it changes every second with nothing having changed. It
 * says when it reaches zero (`onEnd`), once; what that means — a toast, a sound — is the page's.
 */
const declaration = {
  type: 'countdown',
  triggers: {
    onEnd: { action: 'onEnd', title: 'On End', type: 'trigger', params: {}, preview: {} },
    /** One of its last `tickSeconds`, as it begins: `left` is how many remain. */
    onTick: { action: 'onTick', title: 'On Tick', type: 'trigger', params: {}, preview: { left: '' } }
  },
  callbacks: {},
  content: {
    attributes: { endsAt: 0, warnSeconds: 10, tickSeconds: 0 },
    definition: {
      label: 'Countdown',
      type: 'countdown',
      description:
        'Hours, minutes and seconds until `endsAt` (milliseconds since the epoch), ticking; empty when it is 0 or past. ' +
        'Fires `onEnd` once when it reaches zero while shown. The last `warnSeconds` (ten by default) carry ' +
        '`data-state="ending"`; each of the last `tickSeconds` fires `onTick`.',
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
      category: 'Controls',
      owner: 'Plitzi examples',
      license: 'MIT',
      website: '',
      backgroundColor: '#5b5bd6',
      icon: 'fa-regular fa-clock'
    },
    defaultStyle: {
      name: 'Countdown',
      displayMode: 'desktop',
      style: { base: { default: {} } },
      bindingsAllowed: {
        attributes: [
          { path: 'endsAt', label: 'Ends at (ms)' },
          { path: 'warnSeconds', label: 'Seconds before the end it warns' },
          { path: 'tickSeconds', label: 'Last seconds it ticks' }
        ],
        initialState: []
      }
    },
    settings: {}
  }
} satisfies PluginDeclaration<CountdownAttributes>;

export default declaration;
