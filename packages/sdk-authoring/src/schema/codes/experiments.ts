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
  'experiment-split': {
    kind: 'refused',
    means: "an `abTest`'s `split` that is not a whole number from 0 to 100 — the share of visitors who see B",
    fix: '`split: 50`; 0 or 100 ends the experiment, showing everybody one side'
  },
  'experiment-split-differs': {
    kind: 'warned',
    means: 'two `abTest`s naming the same experiment with different splits — they share it, so one split is ignored',
    fix: 'the same `split` on both, or a name of its own for each'
  },
  'experiment-variants': {
    kind: 'refused',
    means: 'an `abTest` that does not hold exactly two `abTestVariant`s — A first, then B — and nothing else',
    fix: '`abTest({ experiment, children: [abTestVariant([…]), abTestVariant([…])] })`'
  },
  'experiment-unknown': {
    kind: 'refused',
    means: 'a template, a binding or a `when` reading an experiment no `abTest` runs — it reads as nothing',
    fix: 'the name it suggests, or an `abTest` with that `experiment`'
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
