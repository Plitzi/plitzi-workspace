import fs from 'node:fs/promises';
import path from 'node:path';

import { exists } from './files';
import { readHistory } from './history';
import { acceptanceText } from './model';
import { expandFiles, sharedReached } from './ownership';
import { ID, isSecretFile, NOT_COPIED_DIRS, under } from './paths';
import { scriptsOf } from '../commands/verify';

import type { RunPlan, RunTask, TaskState } from './model';
import type { Ownership } from './ownership';

/**
 * A plan, held to the rules (RFC 0028 §9.6): the lead writes it, the CLI never interprets a goal. Refused, every
 * reason at once, when it repeats a file across tasks, has a cycle, names a task that is not in it, or a file outside
 * the project's source; then each task's files are expanded with what its units own, what is shared is said, and the
 * whole is estimated.
 */

export interface SharedFile {
  file: string;
  /** The units that reach it, read off the imports. */
  reachedBy: string[];
  /** The task that holds it in the plan, if one does: the others take it by turns or by request. */
  heldBy?: string;
}

export interface PlanEstimate {
  tasks: number;
  agents: number;
  totalMinutes: number;
  criticalPathMinutes: number;
  /** About as long as the run takes with `agents` at once: the longer of the critical path and the work shared out. */
  wallMinutes: number;
  /** One review each at least; more for each round of changes. */
  reviewRounds: number;
  needsConfirmation: boolean;
  why?: string;
  /** At this project's pace — its past runs' minutes over their estimates — when it has enough of them to say. */
  paced?: { wallMinutes: number; ratio: number; runs: number; tasks: number };
}

export interface CheckedPlan {
  runId: string;
  goal: string;
  tasks: RunTask[];
  /** Every shared file of the project, read off the imports. */
  shared: SharedFile[];
  /** The shared files the plan's tasks reach: what they will want by turns or by request. */
  sharedReached: string[];
  /** Files no task writes yet that do not exist: made by the run. */
  created: string[];
  estimate: PlanEstimate;
  notices: string[];
}

export const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

/** Above either, a person confirms the estimate before the run opens (RFC 0028 §14). */
export const CONFIRM_ABOVE = { agents: 5, wallMinutes: 120 } as const;

/** How many agents a run lets work at once when it is not told: between the usual 2 and 5. */
export const DEFAULT_AGENTS = 3;

const normalised = (file: string): string | undefined => {
  if (path.isAbsolute(file) || file.includes('\\')) {
    return undefined;
  }

  const clean = path.posix.normalize(file).replace(/\/$/, '');
  if (clean.startsWith('..') || clean === '.' || clean === '') {
    return undefined;
  }

  return clean;
};

/** The first cycle among `dependsOn`, as the ids around it, or undefined when there is none. */
export const findCycle = (tasks: readonly { id: string; dependsOn: readonly string[] }[]): string[] | undefined => {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const visit = (id: string): string[] | undefined => {
    if (state.get(id) === 'done') {
      return undefined;
    }

    if (state.get(id) === 'visiting') {
      return [...stack.slice(stack.indexOf(id)), id];
    }

    state.set(id, 'visiting');
    stack.push(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) {
      const cycle = visit(dependency);
      if (cycle) {
        return cycle;
      }
    }

    stack.pop();
    state.set(id, 'done');

    return undefined;
  };
  for (const task of tasks) {
    const cycle = visit(task.id);
    if (cycle) {
      return cycle;
    }
  }

  return undefined;
};

/** The longest chain of estimates that starts at each task: what is left of the critical path from it. */
export const chainMinutes = (tasks: readonly RunTask[]): Map<string, number> => {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const dependants = new Map<string, string[]>();
  tasks.forEach(task =>
    task.dependsOn.forEach(dependency => dependants.set(dependency, [...(dependants.get(dependency) ?? []), task.id]))
  );
  const memo = new Map<string, number>();
  const chain = (id: string): number => {
    const known = memo.get(id);
    if (known !== undefined) {
      return known;
    }

    const own = byId.get(id)?.estimateMinutes ?? 0;
    const after = Math.max(0, ...(dependants.get(id) ?? []).map(chain));
    memo.set(id, own + after);

    return own + after;
  };
  tasks.forEach(task => chain(task.id));

  return memo;
};

/** How many tasks can run at once at most: the widest level of the dependency graph. */
const widthOf = (tasks: readonly RunTask[]): number => {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const depth = new Map<string, number>();
  const depthOf = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) {
      return known;
    }

    const value = Math.max(-1, ...(byId.get(id)?.dependsOn ?? []).map(depthOf)) + 1;
    depth.set(id, value);

    return value;
  };
  const levels = new Map<number, number>();
  tasks.forEach(task => levels.set(depthOf(task.id), (levels.get(depthOf(task.id)) ?? 0) + 1));

  return Math.max(1, ...levels.values());
};

export const estimate = (tasks: readonly RunTask[], agentsAsked: number): PlanEstimate => {
  const totalMinutes = tasks.reduce((sum, task) => sum + task.estimateMinutes, 0);
  const chains = chainMinutes(tasks);
  const roots = tasks.filter(task => task.dependsOn.length === 0);
  const criticalPathMinutes = Math.max(0, ...roots.map(task => chains.get(task.id) ?? 0));
  const agents = Math.max(1, Math.min(agentsAsked, widthOf(tasks)));
  const wallMinutes = Math.ceil(Math.max(criticalPathMinutes, totalMinutes / agents));
  const reasons = [
    agentsAsked > CONFIRM_ABOVE.agents
      ? `up to ${String(agentsAsked)} agents at once (more than ${String(CONFIRM_ABOVE.agents)})`
      : '',
    wallMinutes > CONFIRM_ABOVE.wallMinutes
      ? `about ${String(wallMinutes)} minutes (more than ${String(CONFIRM_ABOVE.wallMinutes)})`
      : ''
  ].filter(Boolean);

  return {
    tasks: tasks.length,
    agents,
    totalMinutes,
    criticalPathMinutes,
    wallMinutes,
    reviewRounds: tasks.length,
    needsConfirmation: reasons.length > 0,
    ...(reasons.length > 0 ? { why: reasons.join(', ') } : {})
  };
};

/** Each task's estimate scaled to how this project's runs went: a task of no less than a minute. */
export const atPace = (tasks: readonly RunTask[], ratio: number): RunTask[] =>
  tasks.map(task => ({ ...task, estimateMinutes: Math.max(1, Math.round(task.estimateMinutes * ratio)) }));

const pacedEstimate = async (
  root: string,
  tasks: readonly RunTask[],
  agentsAsked: number
): Promise<Pick<PlanEstimate, 'paced'>> => {
  const history = await readHistory(root);

  return history
    ? { paced: { ...history, wallMinutes: estimate(atPace(tasks, history.ratio), agentsAsked).wallMinutes } }
    : {};
};

const isOutsideSource = (file: string): boolean =>
  NOT_COPIED_DIRS.has(file.split('/')[0]) || file.split('/').includes('node_modules');

/** A command line as a shell reads it: words split at unquoted spaces, each command of `&&`, `||`, `;` or `|` apart. */
const shellCommands = (line: string): string[][] => {
  const commands: string[][] = [[]];
  let word: string | undefined;
  let quote: string | undefined;
  const end = (): void => {
    if (word !== undefined) {
      commands[commands.length - 1]?.push(word);
      word = undefined;
    }
  };
  for (let index = 0; index < line.length; index += 1) {
    const char = line.charAt(index);
    if (quote !== undefined) {
      if (char === quote) {
        quote = undefined;
      } else {
        word = (word ?? '') + char;
      }
    } else if (char === '\x22' || char === '\x27') {
      quote = char;
      word = word ?? '';
    } else if (/\s/.test(char)) {
      end();
    } else if (char === ';' || char === '|' || char === '&') {
      end();
      if (commands.at(-1)?.length !== 0) {
        commands.push([]);
      }
    } else {
      word = (word ?? '') + char;
    }
  }

  end();

  return commands.filter(command => command.length > 0);
};

/**
 * The words a `plitzi page check` (or `page shot`) in `check` reads as pages that are no path — `week` out of
 * `--expect digest-title~This week`, the shell having split an unquoted text: the page asked for is never there.
 */
const strayPages = (check: string): string[] =>
  shellCommands(check).flatMap(words => {
    const at = words.findIndex(
      (word, index) => word === 'page' && (words[index + 1] === 'check' || words[index + 1] === 'shot')
    );
    if (at === -1 || !words.slice(0, at).some(word => word === 'plitzi' || word.endsWith('/plitzi'))) {
      return [];
    }

    const stray: string[] = [];
    const rest = words.slice(at + 2);
    for (let index = 0; index < rest.length; index += 1) {
      const word = rest[index] ?? '';
      if (word.startsWith('-')) {
        // A flag's value follows it, unless written `--flag=value` or another flag comes next.
        if (!word.includes('=') && !(rest[index + 1] ?? '-').startsWith('-')) {
          index += 1;
        }
      } else if (!word.startsWith('/') && !word.includes('$')) {
        stray.push(word);
      }
    }

    return stray;
  });

/**
 * What would make a task's acceptance unworkable, said before the run opens rather than at its `complete`: a line that
 * says nothing, a check that is no command, one that reads the credentials no agent touches, or one that asks for the
 * copy served (`$PLITZI_URL`) in a project with no start script to serve it.
 */
export const acceptanceProblems = async (root: string, task: RunPlan['tasks'][number]): Promise<string[]> => {
  const problems: string[] = [];
  for (const each of task.acceptance) {
    const said = acceptanceText(each).trim();
    if (said === '') {
      problems.push(`Task "${task.id}": a line of its acceptance says nothing — say what is asked`);
      continue;
    }

    if (typeof each === 'string') {
      continue;
    }

    const check = each.check.trim();
    if (check === '') {
      problems.push(`Task "${task.id}": "${said}" has an empty check — give the command, or leave the line as text`);
    } else if (/(^|[\s'"/=<])\.env(\.[\w.-]+)?($|[\s'";|&>)])/.test(check) && !check.includes('.env.example')) {
      problems.push(`Task "${task.id}": the check of "${said}" reads .env, the credentials no agent touches`);
    } else if (strayPages(check).length > 0) {
      const stray = strayPages(check);
      problems.push(
        `Task "${task.id}": the check of "${said}" hands page check ${stray.map(word => `"${word}"`).join(', ')} as a page — a text with a space split by the shell: quote it (--expect "id~Two words")`
      );
    } else if (check.includes('PLITZI_URL')) {
      const scripts = await scriptsOf(root).catch(() => ({}));
      if (!['start', 'start:dev'].some(name => Object.hasOwn(scripts, name))) {
        problems.push(
          `Task "${task.id}": the check of "${said}" names $PLITZI_URL, and the project has no start script to serve the copy with`
        );
      }
    }
  }

  return problems;
};

export const checkPlan = async (
  root: string,
  plan: RunPlan,
  ownership: Ownership,
  agentsAsked: number
): Promise<CheckedPlan> => {
  const problems: string[] = [];
  const notices: string[] = [];
  if (!ID.test(plan.runId)) {
    problems.push(`runId "${plan.runId}": a run's name is lowercase letters, digits, - and _, up to 64`);
  }

  if (plan.tasks.length === 0) {
    problems.push('The plan has no tasks');
  }

  const ids = new Set<string>();
  for (const task of plan.tasks) {
    if (!ID.test(task.id)) {
      problems.push(`Task "${task.id}": a task's id is lowercase letters, digits, - and _, up to 64`);
    }

    if (ids.has(task.id)) {
      problems.push(`Task "${task.id}" is in the plan twice`);
    }

    ids.add(task.id);
    if (task.estimateMinutes <= 0) {
      problems.push(`Task "${task.id}": its estimate is in minutes, more than 0`);
    }

    if (task.files.length === 0) {
      problems.push(`Task "${task.id}" writes no file: name what it writes`);
    }

    if (task.role !== undefined && !ID.test(task.role)) {
      problems.push(
        `Task "${task.id}": its role "${task.role}" is a name — developer, designer, reviewer, tester, writer`
      );
    }

    problems.push(...(await acceptanceProblems(root, task)));
  }

  for (const task of plan.tasks) {
    for (const dependency of task.dependsOn) {
      if (dependency === task.id) {
        problems.push(`Task "${task.id}" depends on itself`);
      } else if (!ids.has(dependency)) {
        problems.push(`Task "${task.id}" depends on "${dependency}", which is not in the plan`);
      }
    }
  }

  const cycle = findCycle(plan.tasks);
  if (cycle) {
    problems.push(`The plan has a cycle: ${cycle.join(' → ')}`);
  }

  const holder = new Map<string, string>();
  const created: string[] = [];
  const tasks: RunTask[] = [];
  for (const task of plan.tasks) {
    const files: string[] = [];
    for (const raw of task.files) {
      const file = normalised(raw);
      if (file === undefined) {
        problems.push(`Task "${task.id}": "${raw}" is not a path inside the project (relative, with forward slashes)`);
        continue;
      }

      if (isSecretFile(file)) {
        problems.push(`Task "${task.id}": ${file} holds credentials, which no agent touches`);
        continue;
      }

      if (isOutsideSource(file)) {
        problems.push(`Task "${task.id}": ${file} is not the project's source (${file.split('/')[0]}/ is left out)`);
        continue;
      }

      files.push(file);
    }

    const expanded = expandFiles(ownership, files);
    for (const file of expanded) {
      if ((await fs.stat(under(root, file)).catch(() => undefined))?.isDirectory()) {
        problems.push(
          `Task "${task.id}": ${file} is a folder — name its files, or a plugin's folder (plitzi space overview lists the units)`
        );
        continue;
      }

      const other = holder.get(file);
      if (other !== undefined && other !== task.id) {
        problems.push(`${file} is in "${other}" and "${task.id}": one agent per file — give it to one of them`);
      }

      holder.set(file, task.id);
      if (!(await exists(under(root, file))) && !created.includes(file)) {
        created.push(file);
      }
    }

    tasks.push({ ...task, files: expanded, kind: 'work' });
  }

  /** Whether `a` is done before `b` starts: `b` waits for it, directly or through what it waits for. */
  const before = (a: string, b: string): boolean => {
    const seen = new Set<string>();
    const visit = (id: string): boolean => {
      if (seen.has(id)) {
        return false;
      }

      seen.add(id);
      const task = plan.tasks.find(each => each.id === id);

      return task !== undefined && (task.dependsOn.includes(a) || task.dependsOn.some(visit));
    };

    return visit(b);
  };

  // What tasks say they will change outside their own files: two on one file meet at `complete`, and the lead sees it now.
  const touchedBy = new Map<string, string[]>();
  for (const task of plan.tasks) {
    for (const raw of task.touches ?? []) {
      const file = normalised(raw);
      if (file === undefined || isSecretFile(file) || isOutsideSource(file)) {
        problems.push(`Task "${task.id}": it touches "${raw}", which is not a file of the project's source`);
        continue;
      }

      const owner = holder.get(file);
      if (owner === task.id) {
        continue;
      }

      // One that waits for the holder finds the file free, by turns, once the holder is done.
      if (owner !== undefined && !before(owner, task.id)) {
        notices.push(
          `"${task.id}" touches ${file}, which "${owner}" holds while it works: it proposes its change to "${owner}" (task propose) or waits for it — or depends on it`
        );
      }

      touchedBy.set(file, [...(touchedBy.get(file) ?? []), task.id]);
    }
  }

  [...touchedBy]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, ids]) => ids.length > 1)
    .forEach(([file, ids]) => {
      const together = ids.filter(id => !ids.some(other => other !== id && (before(id, other) || before(other, id))));
      if (together.length > 1) {
        notices.push(
          `${file} is changed by ${together.map(id => `"${id}"`).join(' and ')} at once: at complete, changes to different lines merge by themselves; the same lines conflict, and one redoes its change — order them (dependsOn) if they change the same thing`
        );
      }
    });

  for (const contract of plan.contracts ?? []) {
    if (!ids.has(contract.owner)) {
      problems.push(
        `The contract on ${contract.resource} is owned by "${contract.owner}", which is not a task of the plan`
      );
    }
  }

  if (problems.length > 0) {
    throw new PlanRefusal(problems);
  }

  const shared: SharedFile[] = [...ownership.shared]
    .map(([file, reachedBy]) => {
      const heldBy = holder.get(file);

      return { file, reachedBy, ...(heldBy ? { heldBy } : {}) };
    })
    .sort((a, b) => a.file.localeCompare(b.file));
  shared
    .filter(file => file.heldBy !== undefined)
    .forEach(file =>
      notices.push(
        `${file.file} is ${ownership.entries.includes(file.file) ? 'an entry of the project' : `shared (${String(file.reachedBy.length)} units reach it)`} and "${String(file.heldBy)}" holds it until it is done: then the others take it by turns or by request`
      )
    );
  created.forEach(file => notices.push(`${file} does not exist yet: the run makes it`));
  // What reads a task's file and is in no task: changed under it, never by it — the lead's to plan, or to leave.
  const planned = new Set(tasks.flatMap(task => task.files));
  const outsiders = new Map<string, Set<string>>();
  for (const task of tasks) {
    for (const file of task.files) {
      for (const importer of ownership.importedBy.get(file) ?? []) {
        if (!planned.has(importer) && !ownership.entries.includes(importer)) {
          outsiders.set(importer, (outsiders.get(importer) ?? new Set<string>()).add(`${file} (${task.id})`));
        }
      }
    }
  }

  [...outsiders]
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([importer, files]) =>
      notices.push(
        `${importer} imports ${[...files].join(', ')}, and no task holds it: it changes under them — give it to a task if it must follow`
      )
    );

  return {
    runId: plan.runId,
    goal: plan.goal,
    tasks,
    shared,
    // What the tasks reach through their imports, and what they said they will touch: none of it held by one.
    sharedReached: [
      ...new Set([
        ...sharedReached(
          ownership,
          plan.tasks.flatMap(task => task.files)
        ),
        ...touchedBy.keys()
      ])
    ]
      .filter(file => !holder.has(file))
      .sort(),
    created: created.sort(),
    estimate: { ...estimate(tasks, agentsAsked), ...(await pacedEstimate(root, tasks, agentsAsked)) },
    notices
  };
};

export class PlanRefusal extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`The plan is refused:\n${problems.map(problem => `  - ${problem}`).join('\n')}`);
    this.name = 'PlanRefusal';
    this.problems = problems;
  }
}

/** Whether every task `task` depends on is done. */
export const dependenciesDone = (task: RunTask, states: ReadonlyMap<string, TaskState>): boolean =>
  task.dependsOn.every(dependency => states.get(dependency)?.status === 'done');

/**
 * The tasks that can be taken now, best first: ready (their dependencies done, nothing blocking them, nobody on them),
 * by priority, then the one that starts the longest chain still to do, then by id — the same input, the same order.
 */
export const readyTasks = (
  tasks: readonly RunTask[],
  states: ReadonlyMap<string, TaskState>,
  held: ReadonlySet<string>
): RunTask[] => {
  const chains = chainMinutes(tasks);

  return tasks
    .filter(task => {
      const status = states.get(task.id)?.status ?? 'pending';

      return (status === 'pending' || status === 'ready') && !held.has(task.id) && dependenciesDone(task, states);
    })
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        (chains.get(b.id) ?? 0) - (chains.get(a.id) ?? 0) ||
        a.id.localeCompare(b.id)
    );
};
