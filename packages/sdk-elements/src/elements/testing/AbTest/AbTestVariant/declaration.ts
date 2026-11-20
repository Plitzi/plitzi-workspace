/** Static declaration for AbTestVariant: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';
import { AB_TEST_TYPE, AB_TEST_VARIANT_TYPE } from '@plitzi/sdk-shared/experiments';

import type { AbTestVariantProps } from './AbTestVariant';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type AbTestVariantAttributes = AuthorableAttributes<AbTestVariantProps>;

const declaration = elementDeclaration<AbTestVariantAttributes>()({
  type: AB_TEST_VARIANT_TYPE,
  ancestorType: AB_TEST_TYPE,
  content: {
    attributes: {},
    definition: {
      label: 'A/B Variant',
      description:
        'One side of an abTest: its first variant is A, its second B. Only the side a visitor sees is drawn.',
      items: []
    },
    builder: {
      canDelete: false,
      canDragDrop: false,
      canMove: false,
      canSnippet: false,
      itemsNotAllowed: [AB_TEST_VARIANT_TYPE]
    },
    market: {
      category: 'testing',
      icon: 'fa-solid fa-flask'
    },
    defaultStyle: {
      style: { base: { default: {} } },
      subTypes: {}
    }
  }
});

export default declaration;
