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
    iconPlacement: valuesOf<NonNullable<LinkProps['iconPlacement']>>()(['before', 'after']),
    current: valuesOf<NonNullable<LinkProps['current']>>()(['page', 'section'])
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
      iconPlacement: 'before',
      current: 'page'
    },
    definition: {
      label: 'Link',
      description:
        'Navigation. Moves the user between pages of the site or to an external URL (its `mode`/`href` decide which). Use ' +
        'this to go page-to-page rather than a button + interaction. Its words are its own `content` and an icon beside ' +
        'them its `icon` (Font Awesome classes) — no text or fontAwesome element inside it for them. It marks itself ' +
        'current on the page it leads to (`aria-current`, the `current` style state); its `current` set to `section` ' +
        'keeps it current on every page under its path too — a menu entry for a section and its pages.',
      items: [],
      styleSelectors: {
        icon: ''
      }
    },
    builder: {
      itemsNotAllowed: ['link']
    },
    market: {
      category: 'basic',
      icon: 'fa-solid fa-link'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            display: 'inline-block',
            // The page's colour, whatever the space made it — as the stylesheet renders it (`_link.scss`).
            color: 'inherit',
            'text-decoration': 'none',
            cursor: 'pointer'
          }
        }
      }
    }
  }
});

export default declaration;
