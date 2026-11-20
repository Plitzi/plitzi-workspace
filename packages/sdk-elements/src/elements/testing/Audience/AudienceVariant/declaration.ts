/** Static declaration for AudienceVariant: type, default attributes and builder metadata. Data only, no React. */
import { AUDIENCE_TYPE, AUDIENCE_VARIANT_TYPE } from '@plitzi/sdk-shared/audiences';
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';

import type { AudienceVariantProps } from './AudienceVariant';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type AudienceVariantAttributes = AuthorableAttributes<AudienceVariantProps>;

const declaration = elementDeclaration<AudienceVariantAttributes>()({
  type: AUDIENCE_VARIANT_TYPE,
  ancestorType: AUDIENCE_TYPE,
  content: {
    attributes: { when: { combinator: 'and', rules: [] } },
    definition: {
      label: 'Audience Variant',
      description:
        'One variant of an audience, for the visitors its `when` matches; with no conditions, for everybody the ' +
        'variants before it did not take. Only the variant a visitor is shown is drawn.',
      items: []
    },
    builder: {
      canSnippet: false,
      itemsNotAllowed: [AUDIENCE_VARIANT_TYPE]
    },
    market: {
      category: 'testing',
      icon: 'fa-solid fa-users-viewfinder'
    },
    defaultStyle: {
      style: { base: { default: {} } },
      subTypes: {}
    }
  }
});

export default declaration;
