/** Static declaration for Page: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '../../../authoring/declare';

import type { PageProps } from './Page';
import type { AuthorableAttributes } from '../../../authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type PageAttributes = AuthorableAttributes<PageProps>;

const declaration = elementDeclaration<PageAttributes>()({
  type: 'page',
  content: {
    attributes: {
      enabled: true,
      name: 'Page',
      slug: '',
      folder: '',
      layout: '',
      layoutContainer: '',
      seoEnabled: false,
      seoPageTitle: 'Title',
      seoPageDescription: 'Description'
    },
    definition: {
      label: 'Page',
      type: 'page',
      description:
        'The root of a routable screen. Managed through the page ops (upsertPage/deletePage), not added as a child ' +
        'element.',
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
      canDelete: false,
      canSelect: true,
      canDragDrop: false,
      canMove: false,
      canTemplate: true,
      itemsAllowed: [],
      itemsNotAllowed: []
    },
    market: {
      category: 'internal',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fas fa-file'
    },
    defaultStyle: {
      name: 'Page',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            display: 'flex',
            'flex-direction': 'column',
            'min-height': '100%',
            'min-width': '100%',
            'font-family': 'Arial',
            color: '#333',
            'font-size': '14px',
            'font-weight': 400,
            'line-height': '16px',
            'text-align': 'left',
            'background-color': '#ffffff'
          }
        }
      }
    },
    settings: {}
  }
});

export default declaration;
