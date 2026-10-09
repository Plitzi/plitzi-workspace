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
      description: 'A custom element slot whose behaviour is supplied by a host/plugin component.'
    },
    market: {
      category: 'advanced',
      icon: 'fa-solid fa-paintbrush'
    },
    defaultStyle: {
      name: 'Custom Element',
      style: {
        base: {
          default: {
            display: 'flex',
            'justify-content': 'center',
            'align-items': 'center'
          }
        }
      }
    }
  }
});

export default declaration;
