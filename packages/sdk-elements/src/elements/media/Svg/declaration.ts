/** Static declaration for Svg: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { SvgProps } from './Svg';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type SvgAttributes = AuthorableAttributes<SvgProps>;

const declaration = elementDeclaration<SvgAttributes>()({
  type: 'svg',
  content: {
    attributes: {
      content: '',
      label: ''
    },
    definition: {
      label: 'SVG',
      type: 'svg',
      description: 'A drawing written as SVG markup, coloured by its class.',
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
      canSnippet: true,
      itemsAllowed: [],
      itemsNotAllowed: []
    },
    market: {
      category: 'media',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-bezier-curve'
    },
    defaultStyle: {
      name: 'Svg',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            display: 'inline-flex',
            width: '24px',
            height: '24px'
          }
        }
      }
    },
    settings: {}
  }
});

export default declaration;
