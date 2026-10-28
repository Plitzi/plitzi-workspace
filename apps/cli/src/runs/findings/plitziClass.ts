import type { FindingKind } from './types';

/**
 * How one of Plitzi's findings asks to be taken up — the line `docs/en/improving-the-cli.md` draws between what is
 * Plitzi's to change and what is not. What the run measured is put in its class here; what an agent or the lead said
 * in their own words is theirs to read, and waits to be triaged by that page's questions.
 */
export type PlitziClass = 'wrong' | 'no-way' | 'in-the-way' | 'said';

/** The classes in the order they are taken up: a word that was not true first — an agent believes it. */
export const PLITZI_CLASSES: readonly (readonly [PlitziClass, string])[] = [
  ['wrong', 'Plitzi got it wrong — a bug, or what it said was not true'],
  ['no-way', 'No way through Plitzi — the agents went round it'],
  ['in-the-way', 'Plitzi in the way — refused what was meant, answered too long to act on'],
  ['said', 'Said by the agents and the lead — to triage (docs/en/improving-the-cli.md)']
];

/** The measured kinds that can be Plitzi's, each in its class; any other is read as said, and triaged. */
const CLASS_OF: Partial<Record<FindingKind, PlitziClass>> = {
  crashed: 'wrong',
  'command-errors': 'wrong',
  'two-tasks': 'wrong',
  'two-sessions': 'wrong',
  'approval-missing': 'wrong',
  'preview-sync': 'wrong',
  'lines-amended': 'wrong',
  'own-script': 'no-way',
  'scratch-script': 'no-way',
  'scratch-package': 'no-way',
  'scratch-copy': 'no-way',
  'repeated-call': 'no-way',
  'explain-missed': 'no-way',
  'explain-topic': 'no-way',
  'refused-as-written': 'in-the-way',
  'refused-loop': 'in-the-way',
  'large-output': 'in-the-way'
};

export const plitziClassOf = (kind: FindingKind): PlitziClass => CLASS_OF[kind] ?? 'said';
