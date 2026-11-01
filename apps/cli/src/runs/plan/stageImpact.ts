import type { PlannedTask, TaskStatus } from '../core/model';

/**
 * What a stage's new work reaches of the run's own, said before it is stacked (`run open <stage>`, `--dry-run` first): a
 * change the person asks mid-run lands on tasks already approved, at work or still to come, and on their tests — and
 * met only at `complete`, or at the finish, it was the lead's to repair (Carlos: "debe ser inteligente para determinar
 * qué tareas pueden ser impactadas… sino al completar habrá problemas"). Each task reached is said with what to do by
 * where it stands: an approved one's acceptance runs again at the finish on the whole result; one at work has an agent to
 * tell; one not taken is amended; a test that imports what changes runs at every check of the stage's task.
 */

/** A task of the run, where it stands, and who is at it. */
export interface RunTaskNow {
  task: Pick<PlannedTask, 'id' | 'files' | 'touches' | 'dependsOn' | 'acceptance'>;
  status: TaskStatus;
  agent?: string;
}

export interface ImpactInput {
  /** The stage's tasks, as checked — its tasks of tests among them. */
  stage: readonly Pick<PlannedTask, 'id' | 'files' | 'dependsOn' | 'testsOf'>[];
  run: readonly RunTaskNow[];
  /** Who imports each file, in the run's approved state (`Ownership.importedBy`). */
  importedBy: ReadonlyMap<string, readonly string[]>;
  /** The test files that import each module, in the run's approved state (`testsImporting`). */
  testsOf: ReadonlyMap<string, readonly string[]>;
}

/** The files that depend on these, all the way back: what a change to them reaches. */
const reachOf = (files: readonly string[], importedBy: ImpactInput['importedBy']): Set<string> => {
  const seen = new Set(files);
  const queue = files.flatMap(file => importedBy.get(file) ?? []);
  while (queue.length > 0) {
    const next = queue.shift();
    if (next !== undefined && !seen.has(next)) {
      seen.add(next);
      queue.push(...(importedBy.get(next) ?? []));
    }
  }

  return seen;
};

const list = (files: readonly string[]): string =>
  files.length > 3 ? `${files.slice(0, 3).join(', ')} +${String(files.length - 3)}` : files.join(', ');

/** What to do with a task the change reaches, by where it stands. */
const doWith = (each: RunTaskNow, stageTask: string): string => {
  switch (each.status) {
    case 'done':
      return 'approved: its acceptance runs again at the finish, on the whole result — amend the lines this changes (run amend)';
    case 'pending':
    case 'ready':
      return `not taken: amend it to what ${stageTask} makes (run amend), or have it wait for ${stageTask} (dependsOn)`;
    case 'in-review':
      return 'in review: amend its acceptance before its review says — the reviewer holds it to it';
    case 'left':
      return 'left out of the run: nothing to do';
    default:
      return `at work${each.agent === undefined ? '' : ` with ${each.agent}`}: tell it what changes (plitzi task message ${each.task.id} "…") and amend its acceptance`;
  }
};

/** The notices a stage's tasks bring: one a task that reaches the run's own work, each task reached a line. */
export const stageImpact = ({ stage, run, importedBy, testsOf }: ImpactInput): string[] => {
  const stageFiles = new Set(stage.flatMap(task => task.files));
  const holderOf = new Map(run.flatMap(each => each.task.files.map(file => [file, each] as const)));

  return stage.flatMap(task => {
    // A task of tests is what updates the tests: what it reaches is its developer task's.
    if (task.testsOf !== undefined || task.files.length === 0) {
      return [];
    }

    const changed = new Set(task.files);
    const reach = reachOf(task.files, importedBy);
    const lines: string[] = [];
    for (const each of run) {
      if (each.status === 'left') {
        continue;
      }

      const rewrites = each.task.files.filter(file => changed.has(file));
      // What it imports of the change, and what it reads (`touches`) of it — the very files it changes too.
      const uses = [
        ...each.task.files.filter(file => reach.has(file) && !changed.has(file)),
        ...(each.task.touches ?? []).filter(file => reach.has(file))
      ];
      if (rewrites.length > 0) {
        lines.push(`${each.task.id} wrote ${list(rewrites)} — ${doWith(each, task.id)}`);
      } else if (uses.length > 0) {
        lines.push(`${each.task.id}'s ${list(uses)} use what it changes — ${doWith(each, task.id)}`);
      }
    }

    // A test that imports what changes runs at every check of this task: one it cannot write fails it at `complete`.
    const tests = [...new Set([...reach].flatMap(file => testsOf.get(file) ?? []))].filter(
      test => !stageFiles.has(test)
    );
    if (tests.length > 0) {
      const owners = [
        ...new Set(
          tests.map(test => {
            const holder = holderOf.get(test);

            return holder === undefined
              ? "the project's"
              : `${holder.task.id}'s${holder.status === 'done' ? ', approved' : ', at work'}`;
          })
        )
      ];
      lines.push(
        `tests ${list(tests)} (${owners.join('; ')}) import what it changes and run at each of its checks: a change of behaviour fails them where it cannot write — name them in its files (or its task of tests) to update them, or keep the behaviour`
      );
    }

    return lines.length > 0
      ? [
          `${task.id} changes what the run has already — plan each now, or its complete and the finish meet it:\n${lines.map(line => `    · ${line}`).join('\n')}`
        ]
      : [];
  });
};
