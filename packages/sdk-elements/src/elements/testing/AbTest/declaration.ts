/** Static declaration for AbTest: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring';
import { AB_TEST_TYPE, AB_TEST_VARIANT_TYPE, EXPERIMENT_VARIANTS } from '@plitzi/sdk-shared/experiments';

import type { AbTestProps } from './AbTest';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';
import type { ExperimentVariant } from '@plitzi/sdk-shared/experiments';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type AbTestAttributes = AuthorableAttributes<AbTestProps>;

const declaration = elementDeclaration<AbTestAttributes>()({
  type: AB_TEST_TYPE,
  attributeValues: {
    builderVariant: valuesOf<ExperimentVariant>()(EXPERIMENT_VARIANTS)
  },
  content: {
    attributes: {
      experiment: '',
      builderVariant: 'a'
    },
    definition: {
      label: 'A/B Test',
      description:
        'An A/B test: two to five `abTestVariant`s (A first, then B…E), of which each visitor sees one — drawn in ' +
        "proportion to the variants' `weight`s — and keeps seeing it when they reload or come back, through a cookie. " +
        'The server draws only that variant. Its `experiment` names it: every A/B test with the same name shows a ' +
        "visitor the same variant, and `{{ experiments.<name> }}` reads it (`'a'`, `'b'`…) for a flow to report. A " +
        'variant at weight 0 is shown to nobody; one left with a weight ends the experiment, everybody sees it.',
      items: []
    },
    builder: {
      itemsAllowed: [AB_TEST_VARIANT_TYPE]
    },
    market: {
      category: 'testing',
      icon: 'fa-solid fa-flask'
    },
    defaultStyle: {
      style: { base: { default: {} } },
      subTypes: {}
    }
  },
  initialItems: [AB_TEST_VARIANT_TYPE, AB_TEST_VARIANT_TYPE]
});

export default declaration;
