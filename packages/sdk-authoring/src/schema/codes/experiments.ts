import type { AuthoringCodeEntry } from './entry';

/** A/B tests (`abTest`). */
export const EXPERIMENT_CODES = {
  'experiment-unnamed': {
    kind: 'warned',
    means: 'an `abTest` with no `experiment` — it runs nothing, and every visitor sees variant A',
    fix: "`experiment: 'heroTest'`"
  },
  'experiment-name': {
    kind: 'refused',
    means: "an `abTest`'s `experiment` that a template cannot read as `experiments.x`",
    fix: 'letters, digits and `_`, starting with a letter or `_`'
  },
  'experiment-weight': {
    kind: 'refused',
    means:
      "an `abTestVariant`'s `weight` that is not a whole number from 0 to 100, or a test whose variants all weigh 0",
    fix: '`weight: 50`; 0 shows a variant to nobody, and at least one has to show'
  },
  'experiment-weights-differ': {
    kind: 'warned',
    means: 'two `abTest`s naming the same experiment with different weights — they share it, so one set is ignored',
    fix: 'the same weights on both, or a name of its own for each'
  },
  'experiment-builder-variant': {
    kind: 'warned',
    means: "an `abTest`'s `builderVariant` naming a variant it does not have — the builder shows A",
    fix: "a variant it has: `'a'` up to as many as its `abTestVariant`s"
  },
  'experiment-variants': {
    kind: 'refused',
    means: 'an `abTest` that does not hold two to five `abTestVariant`s — A first, then B… — and nothing else',
    fix: '`abTest({ experiment, children: [abTestVariant([…]), abTestVariant([…])] })`'
  },
  'experiment-unknown': {
    kind: 'refused',
    means: 'a template, a binding or a `when` reading an experiment no `abTest` runs — it reads as nothing',
    fix: 'the name it suggests, or an `abTest` with that `experiment`'
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
