import type { FullscreenToggleProps } from './FullscreenToggle';
import type { PluginDeclaration } from '@plitzi/plitzi-sdk';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type FullscreenToggleAttributes = Omit<FullscreenToggleProps, 'className'>;

/**
 * A button that takes the page full screen, and back.
 *
 * An element rather than a step in a flow because the browser only grants full screen to the click itself: a flow
 * runs its steps asynchronously, after the event has returned, where a browser is entitled to refuse. The button
 * asks from inside its own click handler, where none does. Its frame is whatever class the space gives it; its icon
 * is its own and follows `currentColor`.
 */
const declaration = {
  type: 'fullscreenToggle',
  triggers: {},
  callbacks: {},
  content: {
    attributes: { label: 'Full screen', exitLabel: 'Exit full screen' },
    definition: {
      label: 'Fullscreen Toggle',
      type: 'fullscreenToggle',
      description:
        'A button that takes the whole page full screen and back, with an icon that says which. `label` and ' +
        '`exitLabel` are its accessible names. Not rendered where the browser cannot go full screen (an iPhone).',
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
      backgroundColor: '#04090c',
      icon: 'fa-solid fa-expand'
    },
    defaultStyle: {
      name: 'Fullscreen Toggle',
      displayMode: 'desktop',
      style: { base: { default: {} } },
      bindingsAllowed: {
        attributes: [
          { path: 'label', label: 'Label' },
          { path: 'exitLabel', label: 'Exit label' }
        ],
        initialState: []
      }
    },
    settings: {}
  }
} satisfies PluginDeclaration<FullscreenToggleAttributes>;

export default declaration;
