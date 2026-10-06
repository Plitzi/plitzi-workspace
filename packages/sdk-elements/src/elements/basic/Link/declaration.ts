/** Static declaration for Link: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring/declare';

import type { LinkProps } from './Link';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type LinkAttributes = AuthorableAttributes<LinkProps>;

const declaration = elementDeclaration<LinkAttributes>()({
  type: 'link',
  attributeValues: {
    mode: valuesOf<NonNullable<LinkProps['mode']>>()(['page', 'internal', 'external']),
    target: valuesOf<NonNullable<LinkProps['target']>>()(['self', 'blank', 'parent', 'top']),
    contentPlacement: valuesOf<NonNullable<LinkProps['contentPlacement']>>()(['before', 'after']),
    iconPlacement: valuesOf<NonNullable<LinkProps['iconPlacement']>>()(['before', 'after'])
  },
  content: {
    attributes: {
      href: '#',
      target: 'self',
      mode: 'page',
      hash: '',
      label: '',
      content: '',
      contentPlacement: 'after',
      icon: '',
      iconPlacement: 'before'
    },
    definition: {
      label: 'Link',
      type: 'link',
      description:
        'Navigation. Moves the user between pages of the site or to an external URL (its `mode`/`href` decide which). Use ' +
        'this to go page-to-page rather than a button + interaction. Its words are its own `content` and an icon beside ' +
        'them its `icon` (Font Awesome classes) — no text or fontAwesome element inside it for them.',
      items: [],
      bindings: {},
      styleSelectors: {
        base: '',
        icon: ''
      },
      initialState: {
        visibility: true
      }
    },
    builder: {
      canDelete: true,
      canSelect: true,
      canDragDrop: true,
      canMove: true,
      canSnippet: true,
      itemsAllowed: [],
      itemsNotAllowed: ['link']
    },
    market: {
      category: 'basic',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-link'
    },
    defaultStyle: {
      name: 'Link',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            display: 'inline-block',
            color: 'light-dark(#333, oklch(0.92 0.004 286.32))',
            'text-decoration': 'none',
            cursor: 'pointer'
          }
        }
      }
    },
    settings: {}
  }
});

export default declaration;
