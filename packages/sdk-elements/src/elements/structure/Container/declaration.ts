/** Static declaration for Container: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring/declare';

import type { ContainerProps } from './Container';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ContainerAttributes = AuthorableAttributes<ContainerProps>;

const declaration = elementDeclaration<ContainerAttributes>()({
  type: 'container',
  attributeValues: {
    subType: valuesOf<NonNullable<ContainerProps['subType']>>()([
      'div',
      'header',
      'footer',
      'nav',
      'main',
      'section',
      'article',
      'aside',
      'address',
      'figure',
      'dl',
      'dt',
      'dd',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6'
    ])
  },
  content: {
    attributes: {
      subType: 'div'
    },
    definition: {
      label: 'Container',
      type: 'container',
      description:
        'Generic layout box (a div). The primary building block for structure: groups and positions child elements with ' +
        'flex/grid. Reach for it whenever you need to wrap or arrange other elements.',
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
      itemsNotAllowed: []
    },
    market: {
      category: 'structure',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-regular fa-square'
    },
    defaultStyle: {
      name: 'Container',
      displayMode: 'desktop',
      style: {
        base: {
          default: {}
        }
      },
      subTypes: {}
    },
    settings: {}
  }
});

export default declaration;
