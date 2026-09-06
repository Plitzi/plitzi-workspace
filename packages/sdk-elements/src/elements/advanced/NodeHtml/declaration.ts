/** Static declaration for NodeHtml: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { NodeHtmlProps } from './NodeHtml';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/**
 * What this element can be authored with — its component's own props, minus what the runtime supplies.
 *
 * `id` is excluded because this element spreads `HTMLAttributes`, which carries the DOM `id` — and `id` is also the
 * element's own name in a document, the key everything wires by. One flat prop cannot mean both, and the name has
 * to win: it is what a binding reads this element by. A raw DOM id, in the rare case one is wanted, is still
 * settable through the element's `attributes` on a spec written out longhand.
 */
export type NodeHtmlAttributes = AuthorableAttributes<NodeHtmlProps, 'id'>;

const declaration = elementDeclaration<NodeHtmlAttributes>()({
  type: 'nodeHtml',
  content: {
    attributes: {
      subType: 'div'
    },
    definition: {
      label: 'Html Node',
      type: 'nodeHtml',
      description: 'A single raw HTML tag with custom attributes.',
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
      category: 'advanced',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-brands fa-html5'
    },
    defaultStyle: {
      name: 'Html Node',
      displayMode: 'desktop',
      style: {
        base: {
          default: {}
        }
      },
      subTypes: {
        hr: {
          name: 'HR Node',
          displayMode: 'desktop',
          style: {
            base: {
              default: {
                'border-top-width': '1px'
              }
            }
          }
        }
      }
    },
    settings: {}
  }
});

export default declaration;
