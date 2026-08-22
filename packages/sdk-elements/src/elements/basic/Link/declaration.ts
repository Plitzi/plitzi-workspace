/** Static declaration for Link: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '../../../authoring/declare';

import type { LinkProps } from './Link';
import type { AuthorableAttributes } from '../../../authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type LinkAttributes = AuthorableAttributes<LinkProps>;

const declaration = elementDeclaration<LinkAttributes>()({
  type: 'link',
  content: {
    attributes: {
      href: '#',
      target: 'self',
      mode: 'page',
      label: ''
    },
    definition: {
      label: 'Link',
      type: 'link',
      description:
        'Navigation. Moves the user between pages of the site or to an external URL (its `mode`/`href` decide which). Use ' +
        'this to go page-to-page rather than a button + interaction.',
      items: [],
      bindings: {},
      styleSelectors: {
        base: ''
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
      canTemplate: true,
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
            color: '#333',
            cursor: 'pointer'
          }
        }
      }
    },
    settings: {}
  }
});

export default declaration;
