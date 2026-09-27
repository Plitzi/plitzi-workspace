import type { StickyStackProps } from './StickyStack';
import type { PluginDeclaration } from '@plitzi/plitzi-sdk';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type StickyStackAttributes = Omit<StickyStackProps, 'className'>;

/**
 * Pads of sticky notes, one per paper colour: a note is taken off the top of one and dropped onto the board.
 *
 * An element because taking a note is a press, not a click — the note leaves the pad the moment the pointer goes down,
 * so it can be dragged straight onto the board. It only says which pad: `onPick`. What happens next — the board
 * carrying the note until it is put down — is the page's flow.
 */
const declaration = {
  type: 'stickyStack',
  triggers: {
    onPick: { action: 'onPick', title: 'On Pick', type: 'trigger', params: {}, preview: { fill: '', kind: '' } }
  },
  callbacks: {},
  content: {
    attributes: { colors: 'yellow', pile: true },
    definition: {
      label: 'Sticky Stack',
      type: 'stickyStack',
      description:
        'A pad of sticky notes per paper colour (`colors`, comma-separated; empty offers none) and, with `pile`, a ' +
        'whole pile to put on ' +
        'the board. Pressing one fires `onPick` with its `fill` and `kind` (`sticky` or `stack`). Colours come ' +
        'from `--stack-<colour>`.',
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
      backgroundColor: '#fff3bf',
      icon: 'fa-regular fa-note-sticky'
    },
    defaultStyle: {
      name: 'Sticky Stack',
      displayMode: 'desktop',
      style: { base: { default: {} } },
      bindingsAllowed: {
        attributes: [
          { path: 'colors', label: 'Paper colours' },
          { path: 'pile', label: 'Offer a pile' }
        ],
        initialState: []
      }
    },
    settings: {}
  }
} satisfies PluginDeclaration<StickyStackAttributes>;

export default declaration;
