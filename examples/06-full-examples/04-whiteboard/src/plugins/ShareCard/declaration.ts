import type { ShareCardProps } from './ShareCard';
import type { PluginDeclaration } from '@plitzi/plitzi-sdk';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ShareCardAttributes = Omit<ShareCardProps, 'className'>;

/**
 * A way to hand the page to somebody else: a QR code a phone across the table can scan, the link to copy, and the
 * system's own share sheet where there is one.
 *
 * An element because all three are the browser's — the address it is at, the clipboard, `navigator.share` — and each
 * needs a person's gesture. What the card says once the link is copied is the page's: it fires `onCopied`.
 */
const declaration = {
  type: 'shareCard',
  triggers: {
    onCopied: { action: 'onCopied', title: 'On Copied', type: 'trigger', params: {}, preview: { url: '' } }
  },
  callbacks: {
    copy: { action: 'copy', title: 'Copy Link', type: 'callback', params: {} }
  },
  content: {
    attributes: { url: '', copyLabel: 'Copy link', shareLabel: 'Share…' },
    definition: {
      label: 'Share Card',
      type: 'shareCard',
      description:
        'A QR code of the page’s address (or `url`), the address itself, a button that copies it and — where the ' +
        'system has one — a button that opens its share sheet. Fires `onCopied`; answers `copy`. Colours come from ' +
        '`--share-ink` and `--share-paper`.',
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
      icon: 'fa-solid fa-qrcode'
    },
    defaultStyle: {
      name: 'Share Card',
      displayMode: 'desktop',
      style: { base: { default: {} } },
      bindingsAllowed: {
        attributes: [
          { path: 'url', label: 'Address (the page’s own when empty)' },
          { path: 'copyLabel', label: 'Copy button label' },
          { path: 'shareLabel', label: 'Share button label' }
        ],
        initialState: []
      }
    },
    settings: {}
  }
} satisfies PluginDeclaration<ShareCardAttributes>;

export default declaration;
