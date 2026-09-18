/** Static declaration for Custom: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { CustomProps } from './Custom';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/**
 * What this element can be authored with — its component's own props, minus what the runtime supplies — and
 * anything else: the component its `renderType` names reads its own attributes off this element (a chart's
 * `series`, a map's `height`), so the element carries whatever that component declares.
 */
export type CustomAttributes = AuthorableAttributes<CustomProps> & Record<string, unknown>;

const declaration = elementDeclaration<CustomAttributes>()({
  type: 'custom',
  content: {
    attributes: {
      renderType: '',
      settings: '{}',
      isPlugin: false,
      assets: '',
      scriptUrl: ''
    },
    definition: {
      label: 'Custom',
      type: 'custom',
      description: 'A custom element slot whose behaviour is supplied by a host/plugin component.',
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
      category: 'advanced',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-paintbrush'
    },
    defaultStyle: {
      name: 'Custom Element',
      displayMode: 'desktop',
      style: {
        base: {
          default: {}
        }
      }
    },
    settings: {}
  }
});

export default declaration;
