import type { LintFinding, Severity, SourcePlace } from './types';

/** The skills' references a project carries, where each practice is explained at length. */
const REFERENCE = '.claude/skills/plitzi-authoring/reference';

/**
 * Every rule `plitzi lint` reads the space's source with: what it finds, how much it matters, and where the practice
 * is explained. What authoring suggests about the space it authors to is relayed besides, under authoring's own codes.
 */
export const LINT_RULES = {
  'file-too-long': {
    severity: 'warning',
    means: 'a file of the space too long to read whole',
    docs: `${REFERENCE}/structure.md`
  },
  'pages-in-one-file': {
    severity: 'warning',
    means: 'several pages written in one file',
    docs: `${REFERENCE}/structure.md`
  },
  'inline-records': {
    severity: 'warning',
    means: 'a long list of records written inline in the space’s code',
    docs: `${REFERENCE}/data-and-visibility.md`
  },
  'colour-not-token': {
    severity: 'warning',
    means: 'a colour written out where a token of the space belongs',
    docs: `${REFERENCE}/colours-and-motion.md`
  },
  'repeated-css': {
    severity: 'warning',
    means: 'the same CSS written in several places',
    docs: `${REFERENCE}/layouts.md`
  },
  'special-case-in-map': {
    severity: 'warning',
    means: 'one row of a list singled out by its id inside the `map` that renders it',
    docs: `${REFERENCE}/structure.md`
  },
  'positional-id': {
    severity: 'warning',
    means: 'an element named by its position (`container-45`) in code that is maintained',
    docs: `${REFERENCE}/structure.md`
  },
  'unused-file': {
    severity: 'warning',
    means: 'a file of the space’s folder nothing the space imports reaches',
    docs: `${REFERENCE}/structure.md`
  },
  'disable-names-suggestion': {
    severity: 'warning',
    means:
      'a `plitzi-lint-disable` comment naming a suggestion of authoring’s, which only `quiet` on its element silences',
    docs: `${REFERENCE}/structure.md`
  },
  'space-does-not-author': {
    severity: 'error',
    means: 'the space does not author, so what authoring suggests about it could not be read',
    docs: 'npm run author'
  },
  'source-unreadable': {
    severity: 'error',
    means: 'the space’s source could not be read',
    docs: 'plitzi doctor'
  }
} as const satisfies Record<string, { severity: Severity; means: string; docs: string }>;

export type LintCode = keyof typeof LINT_RULES;

/** A finding of one of this command's own rules, its severity and docs taken from the catalogue. */
export const finding = (code: LintCode, message: string, place?: SourcePlace, others?: SourcePlace[]): LintFinding => ({
  code,
  severity: LINT_RULES[code].severity,
  origin: 'source',
  message,
  ...(place ? { file: place.file, line: place.line, column: place.column } : {}),
  ...(others && others.length > 0 ? { others } : {}),
  docs: LINT_RULES[code].docs
});
