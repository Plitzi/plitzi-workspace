/** Static declaration for Audience: type, default attributes and builder metadata. Data only, no React. */
import { AUDIENCE_TYPE, AUDIENCE_VARIANT_TYPE } from '@plitzi/sdk-shared/audiences';
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';

import type { AudienceProps } from './Audience';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type AudienceAttributes = AuthorableAttributes<AudienceProps>;

const declaration = elementDeclaration<AudienceAttributes>()({
  type: AUDIENCE_TYPE,
  content: {
    attributes: { builderVariant: 0 },
    definition: {
      label: 'Audience',
      description:
        'Shows each visitor the first of its variants whose rule they match. Each `audienceVariant`’s `when` is a ' +
        'rule group over ' +
        'what a flag sees — `environment`, `hostname`, `routeParams.<name>`, `queryParams.<name>` (`utm_source`…), ' +
        '`user.authenticated`, `user.roles`… — and the visitor: `visitor.returning`, `visitor.language` (`es`, ' +
        '`en`), `visitor.device` (`mobile`, `tablet`, `desktop`). A variant with no conditions matches everybody: ' +
        'the "everyone else" an audience ends with. The server draws only the variant shown.',
      items: []
    },
    builder: {
      itemsAllowed: [AUDIENCE_VARIANT_TYPE]
    },
    market: {
      category: 'testing',
      icon: 'fa-solid fa-users-viewfinder'
    },
    defaultStyle: {
      style: { base: { default: {} } },
      subTypes: {}
    }
  },
  initialItems: [AUDIENCE_VARIANT_TYPE, AUDIENCE_VARIANT_TYPE]
});

export default declaration;
