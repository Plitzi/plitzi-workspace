import type TypeScript from 'typescript';

/**
 * - `error`: the space's source could not be read as far as the rule needs — what `lint` says cannot be trusted until
 *   it is fixed.
 * - `warning`: a practice to change — the source works, and grows harder to read and to change than it needs to.
 * - `info`: worth knowing, never a failure, even with `--strict`.
 */
export type Severity = 'error' | 'warning' | 'info';

/** Where a finding was read from: the source itself, by this command, or the space it authors to, by authoring. */
export type FindingOrigin = 'source' | 'authoring';

/** A place in a file, from 1. */
export interface SourcePlace {
  /** Relative to the project's root. */
  file: string;
  line: number;
  column: number;
}

/** One thing found, as data: what a tool branches on (`code`), where it is, and what to write instead. */
export interface LintFinding {
  /** Stable, kebab-case: what a script or an agent matches on. */
  code: string;
  severity: Severity;
  origin: FindingOrigin;
  /** What is wrong and what to write instead, in one sentence or two. */
  message: string;
  /** Relative to the project's root. Absent for what is about the space as a whole. */
  file?: string;
  line?: number;
  column?: number;
  /** The other places the same thing is written, for a finding about something repeated. */
  others?: SourcePlace[];
  /** Where the practice is explained: a reference of the skills the project carries, or a command. */
  docs: string;
}

/** A file of the space's source, read and parsed once for every rule. */
export interface SpaceSourceFile {
  /** Relative to the project's root. */
  file: string;
  text: string;
  sourceFile: TypeScript.SourceFile;
}

/** What every rule reads. */
export interface LintContext {
  ts: typeof TypeScript;
  root: string;
  /** The module that exports the space, relative to the root: `src/space/index.ts`. */
  entry: string;
  /** Where the project keeps rows of data a provider reads: `src/data` with a server, `public/data` without. */
  dataDir: string;
  /** Every file the space is made of — what its entry imports, followed — in the order they were reached. */
  files: SpaceSourceFile[];
  /** Files of the space's folder nothing the entry imports reaches. */
  unreached: string[];
}

export type Rule = (context: LintContext) => LintFinding[];
