import type { CopyTextProps } from './CopyText';
import type { PluginDeclaration } from '@plitzi/plitzi-sdk';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type CopyTextAttributes = Omit<CopyTextProps, 'className'>;

/**
 * A text to copy — a command, a message — shown, with a button that puts it on the clipboard.
 *
 * An element because the clipboard is the browser's and needs a person's gesture, and because `{url}` in the text is
 * the page's own address, which only the browser knows. What is said once it is copied is the page's: `onCopied`.
 */
const declaration = {
  type: 'copyText',
  triggers: {
    onCopied: { action: 'onCopied', title: 'On Copied', type: 'trigger', params: {}, preview: { text: '' } }
  },
  callbacks: {},
  content: {
    attributes: { text: '', label: 'Copy' },
    definition: {
      label: 'Copy Text',
      type: 'copyText',
      description:
        'A text (`text`, where `{url}` is the page’s address) and a button (`label`) that copies it. Fires ' +
        '`onCopied`. Colours come from `--copy-field`, `--copy-accent` and `--copy-on-accent`.',
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
      backgroundColor: '#f6f1e7',
      icon: 'fa-regular fa-copy'
    },
    defaultStyle: {
      name: 'Copy Text',
      displayMode: 'desktop',
      style: { base: { default: {} } },
      bindingsAllowed: {
        attributes: [
          { path: 'text', label: 'Text ({url} is the page’s address)' },
          { path: 'label', label: 'Button label' }
        ],
        initialState: []
      }
    },
    settings: {}
  }
} satisfies PluginDeclaration<CopyTextAttributes>;

export default declaration;
