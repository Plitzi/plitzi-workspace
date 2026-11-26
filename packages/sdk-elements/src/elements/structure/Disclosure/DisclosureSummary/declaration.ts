/** Static declaration for DisclosureSummary: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';

import type { DisclosureSummaryProps } from './DisclosureSummary';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type DisclosureSummaryAttributes = AuthorableAttributes<DisclosureSummaryProps>;

const declaration = elementDeclaration<DisclosureSummaryAttributes>()({
  type: 'disclosureSummary',
  ancestorType: 'disclosure',
  content: {
    attributes: { marker: true, label: '' },
    definition: {
      label: 'Disclosure Summary',
      description:
        'What is pressed to open and close a disclosure — its first child, and its name for a screen reader: a text ' +
        'or a heading in it, never a button or a link (it is the control itself), or its `label` when it holds an ' +
        'icon alone (a menu’s burger). Its `marker` is the sign at its end that turns as the disclosure opens (the ' +
        '`marker` slot styles it); off, for a sign of its own.',
      items: [],
      styleSelectors: { marker: '' }
    },
    builder: {
      canDelete: false,
      canDragDrop: false,
      canMove: false,
      canSnippet: false
    },
    market: {
      category: 'structure',
      icon: 'fa-solid fa-heading'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            display: 'flex',
            'align-items': 'center',
            gap: '8px',
            cursor: 'pointer',
            'list-style': 'none'
          }
        },
        marker: {
          default: {
            'flex-shrink': 0,
            'margin-left': 'auto',
            width: '0.45em',
            height: '0.45em',
            'border-right': '2px solid currentColor',
            'border-bottom': '2px solid currentColor',
            transform: 'rotate(45deg)'
          }
        }
      },
      subTypes: {}
    }
  }
});

export default declaration;
