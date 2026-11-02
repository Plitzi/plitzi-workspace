import fs from 'node:fs/promises';
import path from 'node:path';

import { digestOf } from './scaffoldRecord';
import { machineryFiles, seedFiles } from '../../scaffold';
import { RETIRED_MACHINERY } from '../../scaffold/machinery';

import type { SpaceOrigin } from './spaceOrigin';
import type { CreateAnswers } from '../../scaffold';

/**
 * `plitzi upgrade files`: the CLI's machinery as the project has it, file by file — what the command writes and
 * `plitzi doctor` says of each.
 */

/**
 * `seeded`: a file of the project's own that the machinery imports, written because the project had none. `space`: one
 * a space made into a project gave in the CLI's place (`src/main.ts`, from what the space holds) — `plitzi space pull`'s.
 * `removed`: one the CLI no longer writes, as it wrote it (or taken), deleted; `retired`: one the project changed, left.
 * `merged`: a list of the project's own (`LIST_FILES`) given the CLI's lines it lacks, every line of its own kept.
 */
export type FileStatus =
  'current' | 'added' | 'updated' | 'yours' | 'taken' | 'merged' | 'seeded' | 'space' | 'removed' | 'retired';

export interface FilePlan {
  file: string;
  status: FileStatus;
  /** What the CLI writes now. */
  ours: string;
  /** What the project has, when it has the file. */
  yours?: string;
}

export const readText = async (file: string): Promise<string | undefined> => {
  try {
    return await fs.readFile(file, 'utf-8');
  } catch {
    return undefined;
  }
};

const holdsFiles = async (folder: string): Promise<boolean> => {
  try {
    return (await fs.readdir(folder)).length > 0;
  } catch {
    return false;
  }
};

/**
 * The machinery that is a list of lines — what git and Prettier leave alone — where the project's lines and the CLI's
 * both hold: one the project changed keeps all of its own and takes the CLI's it lacks, as a new version's tool writes
 * its outputs somewhere the project must ignore too. Replaced whole only when `--take` says so.
 */
const LIST_FILES: ReadonlySet<string> = new Set(['.gitignore', '.prettierignore']);

/** The CLI's entries a list of the project's lacks, in the CLI's order — its comments and blank lines are not entries. */
export const missingLines = (yours: string, ours: string): string[] => {
  const have = new Set(yours.split('\n').map(line => line.trim()));

  return [
    ...new Set(
      ours
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '' && !line.startsWith('#') && !have.has(line))
    )
  ];
};

const withLines = (yours: string, lines: readonly string[]): string =>
  `${yours.replace(/\n*$/, '')}\n\n# Added by plitzi upgrade: what this CLI's tools write.\n${lines.join('\n')}\n`;

const planFiles = async (
  root: string,
  files: Record<string, string>,
  recorded: Record<string, string>,
  take: readonly string[]
): Promise<FilePlan[]> =>
  Promise.all(
    Object.entries(files).map(async ([file, ours]): Promise<FilePlan> => {
      const yours = await readText(path.join(root, file));
      // A `.gitkeep` keeps a folder in git while it is empty: one with files of its own needs none.
      if (
        yours === undefined &&
        path.basename(file) === '.gitkeep' &&
        (await holdsFiles(path.join(root, file, '..')))
      ) {
        return { file, status: 'current', ours };
      }

      if (yours === undefined) {
        return { file, status: 'added', ours };
      }

      if (yours === ours) {
        return { file, status: 'current', ours, yours };
      }

      if (recorded[file] === digestOf(yours)) {
        return { file, status: 'updated', ours, yours };
      }

      if (take.includes('all') || take.includes(file)) {
        return { file, status: 'taken', ours, yours };
      }

      if (LIST_FILES.has(file)) {
        const lacking = missingLines(yours, ours);

        // Every line of the CLI's there, beside the project's own: nothing of it to change. Recorded as the CLI's
        // version (`ours`), never the project's, which would read next time as written by the CLI — and be replaced.
        return lacking.length > 0
          ? { file, status: 'merged', ours: withLines(yours, lacking), yours }
          : { file, status: 'current', ours, yours };
      }

      return { file, status: 'yours', ours, yours };
    })
  );

export const WRITES: ReadonlySet<FileStatus> = new Set(['added', 'updated', 'taken', 'merged']);

/** Whether `file` is the CLI's once the plan is made: written by it, or already as it writes it. */
const theClisAfter = (plans: readonly FilePlan[], file: string): boolean =>
  plans.some(plan => plan.file === file && (WRITES.has(plan.status) || plan.status === 'current'));

/**
 * The project's own files the machinery imports that it does not have yet — written once, never replaced, and only
 * beside a machinery file of the CLI's that reads them: one the project kept as its own reads nothing of them.
 */
const planSeeds = async (
  root: string,
  seeds: { file: string; contents: string; readBy: string }[],
  plans: readonly FilePlan[]
): Promise<FilePlan[]> => {
  const planned = await Promise.all(
    seeds.map(async ({ file, contents, readBy }): Promise<FilePlan | undefined> =>
      theClisAfter(plans, readBy) && (await readText(path.join(root, file))) === undefined
        ? { file, status: 'seeded', ours: contents }
        : undefined
    )
  );

  return planned.filter((plan): plan is FilePlan => plan !== undefined);
};

/** A file of the machinery an older CLI wrote and this one does not, still in the project. */
export interface RetiredPlan {
  file: string;
  status: 'removed' | 'retired';
}

/**
 * What the CLI no longer writes (`RETIRED_MACHINERY`), still in the project: removed when nobody changed it since the
 * CLI wrote it, or `--take` names it — `retired`, left, when the project did. Only once the machinery file that read it
 * is the CLI's current one: beside one the project made its own, it is still read.
 */
const planRetired = async (
  root: string,
  plans: readonly FilePlan[],
  recorded: Record<string, string>,
  take: readonly string[]
): Promise<RetiredPlan[]> => {
  const planned = await Promise.all(
    Object.entries(RETIRED_MACHINERY).map(async ([file, readBy]): Promise<RetiredPlan | undefined> => {
      const yours = await readText(path.join(root, file));
      if (yours === undefined || !theClisAfter(plans, readBy)) {
        return undefined;
      }

      const asWritten = recorded[file] === digestOf(yours);

      return { file, status: asWritten || take.includes('all') || take.includes(file) ? 'removed' : 'retired' };
    })
  );

  return planned.filter((plan): plan is RetiredPlan => plan !== undefined);
};

/**
 * The machinery as `upgrade` sees it: each file the CLI writes, by what it is to the project (`FileStatus`), the
 * project's own files it reads that the project lacks (`seeds`), the ones it no longer writes still there (`retired`),
 * and the files a space gave in the CLI's place, which are `plitzi space pull`'s (`spaces`). What `plitzi doctor` reads too,
 * so both say the same of every file.
 */
export const machineryPlan = async (
  root: string,
  answers: CreateAnswers,
  { origin, recorded, take = [] }: { origin?: SpaceOrigin; recorded: Record<string, string>; take?: readonly string[] }
): Promise<{ plans: FilePlan[]; seeds: FilePlan[]; retired: RetiredPlan[]; spaces: string[] }> => {
  // A file the space gave in the CLI's place is the space's, kept by `plitzi space pull` — never offered here.
  const given = new Set(Object.keys(origin?.files ?? {}));
  const machinery = Object.entries(machineryFiles(answers));
  const ours = Object.fromEntries(machinery.filter(([file]) => !given.has(file)));
  const plans = await planFiles(root, ours, recorded, take);

  return {
    plans,
    seeds: await planSeeds(root, seedFiles(answers), plans),
    retired: await planRetired(root, plans, recorded, take),
    spaces: machinery.filter(([file]) => given.has(file)).map(([file]) => file)
  };
};
