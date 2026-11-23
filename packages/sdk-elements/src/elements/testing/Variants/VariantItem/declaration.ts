/** Static declaration for VariantItem: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';
import { DEFAULT_VARIANT_WEIGHT } from '@plitzi/sdk-shared/experiments';
import { VARIANT_ITEM_TYPE, VARIANTS_TYPE } from '@plitzi/sdk-shared/variants';

import type { VariantItemProps } from './VariantItem';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type VariantItemAttributes = AuthorableAttributes<VariantItemProps>;

const declaration = elementDeclaration<VariantItemAttributes>()({
  type: VARIANT_ITEM_TYPE,
  ancestorType: VARIANTS_TYPE,
  content: {
    attributes: { weight: DEFAULT_VARIANT_WEIGHT },
    definition: {
      label: 'Variant',
      description:
        'One of the versions a Variants element chooses between — by chance, shown to its share of the visitors; by ' +
        'rules, to the visitors its rule matches. Its share is `weight`, a percent of the visitors (the variants’ add up to 100), and its rule ' +
        '`when` (a rule group; none is everybody else). Only the variant a visitor is shown is drawn.',
      items: []
    },
    builder: {
      canSnippet: false,
      itemsNotAllowed: [VARIANT_ITEM_TYPE]
    },
    market: {
      category: 'testing',
      icon: 'fa-solid fa-code-branch'
    },
    defaultStyle: {
      style: { base: { default: {} } },
      subTypes: {}
    }
  }
});

export default declaration;
