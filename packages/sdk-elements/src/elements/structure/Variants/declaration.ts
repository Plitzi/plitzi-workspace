/** Static declaration for Variants: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration, valuesOf } from '@plitzi/sdk-shared/authoring';
import { CHOOSE_BY, VARIANT_ITEM_TYPE, VARIANTS_TYPE } from '@plitzi/sdk-shared/variants';

import type { VariantsProps } from './Variants';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';
import type { ChooseBy } from '@plitzi/sdk-shared/variants';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type VariantsAttributes = AuthorableAttributes<VariantsProps>;

const declaration = elementDeclaration<VariantsAttributes>()({
  type: VARIANTS_TYPE,
  attributeValues: {
    chooseBy: valuesOf<ChooseBy>()(CHOOSE_BY)
  },
  content: {
    attributes: { chooseBy: 'chance', experiment: '', builderVariant: 0 },
    definition: {
      label: 'Variants',
      description:
        'Shows each visitor one of its variants, chosen by chance or by who they are. By chance (`chooseBy: ' +
        "'chance'`, an A/B test) it holds two to five `variantItem`s, A first: each is shown to its `weight` — the " +
        'percent of the visitors it gets, the variants’ adding up to 100 — and a visitor keeps theirs when they reload or come back, ' +
        'through a cookie. Its `experiment` names it — left empty, the element’s id does — and `{{ experiments.<name> ' +
        "}}` reads the visitor's (`'a'`, `'b'`…). By rules (`chooseBy: 'rules'`) it shows the first variant whose " +
        '`when` the visitor matches: a rule group over what a flag sees — `queryParams.<name>` (`utm_source`…), ' +
        '`user.authenticated`, `user.roles`… — and the visitor: `visitor.returning`, `visitor.language` (`es`), ' +
        '`visitor.device` (`mobile`, `tablet`, `desktop`), `visitor.country` (`ES`, as the CDN in front says it); a variant with no conditions is for everybody else, last. ' +
        'Each variant keeps both, so switching how it chooses loses neither. The server draws only the variant shown.',
      items: []
    },
    builder: {
      itemsAllowed: [VARIANT_ITEM_TYPE]
    },
    market: {
      category: 'structure',
      icon: 'fa-solid fa-shuffle'
    },
    defaultStyle: {
      style: { base: { default: {} } },
      subTypes: {}
    }
  },
  initialItems: [VARIANT_ITEM_TYPE, VARIANT_ITEM_TYPE]
});

export default declaration;
