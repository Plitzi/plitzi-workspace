import type { AuthoringCodeEntry } from './entry';

/** Variants (`variants`): chosen by chance — a test, its `experiment-*` codes — or by rules. */
export const VARIANTS_CODES = {
  'variants-choose-by': {
    kind: 'refused',
    means: "a `variants`' `chooseBy` that is neither `'chance'` nor `'rules'` — it chooses by chance",
    fix: "`chooseBy: 'chance'` or `chooseBy: 'rules'`"
  },
  'variants-items': {
    kind: 'refused',
    means: 'a `variants` holding something beside its `variantItem`s, or too few — two to five by chance, one by rules',
    fix: '`variants({ children: [variantItem([…]), variantItem([…])] })`'
  },
  'variants-builder-variant': {
    kind: 'warned',
    means: "a `variants`' `builderVariant` that is not the place of one of its variants — the builder shows the first",
    fix: 'the place of a variant it has, from 0'
  },
  'variants-rule': {
    kind: 'refused',
    means: "a `variantItem`'s `when` that is not a rule group",
    fix: "`when: { combinator: 'and', rules: [{ field: 'visitor.device', operator: '=', value: 'mobile' }] }`"
  },
  'variants-unreachable': {
    kind: 'warned',
    means: 'by rules, a `variantItem` after one with no rule, which takes everybody left — it is never shown',
    fix: 'move the variant with no rule last, or give it one'
  },
  'variants-no-fallback': {
    kind: 'warned',
    means: 'by rules, a `variants` whose every variant has a rule: a visitor matching none is shown nothing',
    fix: 'end it with a `variantItem` with no `when`, for everybody else'
  },
  'experiment-name': {
    kind: 'refused',
    means: "by chance, a `variants`' `experiment` that a template cannot read as `experiments.x`",
    fix: "letters, digits and `_`, starting with a letter or `_` — or empty, for the element's own name"
  },
  'experiment-weight': {
    kind: 'refused',
    means:
      "by chance, a `variantItem`'s `weight` that is not a whole number from 0 to 100, or variants that all weigh 0",
    fix: '`weight: 50`; 0 shows a variant to nobody, and at least one has to show'
  },
  'experiment-weights-differ': {
    kind: 'warned',
    means: 'two `variants` running the same test with different weights — they share it, so one set is ignored',
    fix: 'the same weights on both, or a test name of its own for each'
  },
  'experiment-unknown': {
    kind: 'refused',
    means: 'a template, a binding or a `when` reading an experiment no `variants` chosen by chance runs',
    fix: 'the name it suggests, or a `variants` with that `experiment`'
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
