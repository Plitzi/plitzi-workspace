import type { PlitziProject } from '../commands/existingProject';
import type { ScaffoldRecord } from '../commands/scaffoldRecord';
import type { SpaceOrigin } from '../commands/spaceOrigin';
import type { CreateAnswers, PackageManager } from '../scaffold';

/**
 * What `plitzi doctor` looks at, in the order it says them: each a part of the project a developer may have changed, and
 * which can stop it from installing, starting, building or going up to Plitzi. What the space says is not among them:
 * that is `npm run author`'s and `plitzi page check`'s.
 */
export const DOCTOR_AREAS = [
  'layout',
  'packages',
  'machinery',
  'config',
  'sources',
  'plugins',
  'data',
  'functions',
  'records',
  'skills'
] as const;

export type DoctorArea = (typeof DOCTOR_AREAS)[number];

/**
 * - `error`: something that does not work — the project does not install, start, author, build or push as it is.
 * - `warning`: something that works today and will not keep working — behind the CLI, a file `upgrade` would replace.
 * - `info`: what the project made its own, said so it is known; never a failure, even with `--strict`.
 */
export type Severity = 'error' | 'warning' | 'info';

/** One thing found, as data: what a tool branches on (`code`), where it is, and what to do about it. */
export interface Finding {
  area: DoctorArea;
  severity: Severity;
  /** Stable, kebab-case: what a script or an agent matches on. */
  code: string;
  message: string;
  /** The file it is about, relative to the project's root — `src/main.ts`, or `src/main.ts:12`. */
  file?: string;
  /** What fixes it: a command to run, or the change to make. */
  fix?: string;
  /**
   * What `plitzi doctor --fix` does about it by itself, when it is simple and safe to: said, then run. One repair may
   * answer several findings (a layout moved at once): it runs once.
   */
  repair?: Repair;
}

/** A change the doctor makes itself, with `--fix`: what it does, in a line, and doing it. */
export interface Repair {
  says: string;
  run: () => Promise<void>;
}

/** What every check reads, gathered once. */
export interface DoctorContext {
  root: string;
  project: PlitziProject;
  /** What the project was made with, as far as what the CLI writes depends on it. */
  answers: CreateAnswers;
  /** `package.json`, parsed — the project's checks start from it, so it is known to be an object. */
  manifest: Record<string, unknown>;
  manager: PackageManager;
  origin: SpaceOrigin | undefined;
  record: ScaffoldRecord | undefined;
}

export type Check = (context: DoctorContext) => Promise<Finding[]>;

type Details = Pick<Finding, 'file' | 'fix' | 'repair'>;

/** Findings of one area, said in one line each: `const say = sayer('packages'); say.error('code', 'message')`. */
export const sayer = (area: DoctorArea) => {
  const of =
    (severity: Severity) =>
    (code: string, message: string, details: Details = {}): Finding => ({ area, severity, code, message, ...details });

  return { error: of('error'), warning: of('warning'), info: of('info') };
};
