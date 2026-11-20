/** Static declaration for AbTestVariant: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';
import { AB_TEST_TYPE, AB_TEST_VARIANT_TYPE, DEFAULT_VARIANT_WEIGHT } from '@plitzi/sdk-shared/experiments';

import type { AbTestVariantProps } from './AbTestVariant';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type AbTestVariantAttributes = AuthorableAttributes<AbTestVariantProps>;

const declaration = elementDeclaration<AbTestVariantAttributes>()({
  type: AB_TEST_VARIANT_TYPE,
  ancestorType: AB_TEST_TYPE,
  content: {
    attributes: { weight: DEFAULT_VARIANT_WEIGHT },
    definition: {
      label: 'A/B Variant',
      description:
        'One variant of an abTest — A, B… by its place — shown to its `weight`’s share of the visitors (0–100, against ' +
        'the others’). Only the variant a visitor is shown is drawn.',
      items: []
    },
    builder: {
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
