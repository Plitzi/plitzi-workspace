import type { Finding, FindingKind } from './types';

/**
 * How one of Plitzi's findings asks to be taken up — the line `docs/en/improving-the-cli.md` draws between what is
 * Plitzi's to change and what is not. The run follows it on both sides: whoever says something of Plitzi says which of
 * the three it is (`run notice --plitzi <how>`, `--plitzi-wrong`/`--plitzi-no-way`/`--plitzi-in-the-way` with a round),
 * what the run measures is put in its class here, and only what neither placed waits to be triaged.
 */
export const PLITZI_HOWS = ['wrong', 'no-way', 'in-the-way'] as const;

/** What someone who worked says a thing of Plitzi was. */
export type PlitziHow = (typeof PLITZI_HOWS)[number];

export type PlitziClass = PlitziHow | 'to-triage';

/** What each is, as the help and the agents' prompt say it. */
export const PLITZI_HOW_MEANS: Readonly<Record<PlitziHow, string>> = {
  wrong: 'Plitzi said or did something untrue — a success that was not, a count read backwards, advice that breaks',
  'no-way': 'something you needed had no way through Plitzi, and you went round it — a script, call after call',
  'in-the-way': 'Plitzi refused what you plainly meant, or answered too long to act on'
};

/** The classes in the order they are taken up: a word that was not true first — an agent believes it. */
export const PLITZI_CLASSES: readonly (readonly [PlitziClass, string])[] = [
  ['wrong', 'Plitzi got it wrong — a bug, or what it said was not true'],
  ['no-way', 'No way through Plitzi — the agents went round it'],
  ['in-the-way', 'Plitzi in the way — refused what was meant, answered too long to act on'],
  ['to-triage', 'Placed by no one — to triage (docs/en/improving-the-cli.md)']
];

/** The measured kinds that can be Plitzi's, each in its class; any other is triaged. */
const CLASS_OF: Partial<Record<FindingKind, PlitziHow>> = {
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

/** Its class: as whoever said it placed it, else as the run measured it, else to triage. */
export const plitziClassOf = (finding: Pick<Finding, 'kind' | 'how'>): PlitziClass =>
  finding.how ?? CLASS_OF[finding.kind] ?? 'to-triage';

export const isPlitziHow = (value: unknown): value is PlitziHow => PLITZI_HOWS.some(how => how === value);
