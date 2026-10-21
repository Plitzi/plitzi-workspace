import fs from 'node:fs/promises';
import path from 'node:path';

import { namesServedCopy } from './acceptance';
import { expectationNotices } from './expectations';
import { exists } from './files';
import { readHistory } from './history';
import { inventoryLeftOut, inventoryProblems } from './inventory';
import { acceptanceText } from './model';
import { expandFiles, sharedReached } from './ownership';
import { ID, isSecretFile, NOT_TASK_DIRS, under } from './paths';
import { shellCommands } from './shell';
import { isResearch } from './spike';
import { DESIGNER, DEVELOPER, reviewsDesign, roleProblems, startedAgents, teamSize, teamTakes, TESTER } from './team';
import { testSetupOf, withTestTasks } from './tests';
import { reviewedAsUi } from './uiFiles';
import { byUrgency, chainMinutes } from './urgency';
import { scriptsOf } from '../commands/verify';

import type { Quality, RunPlan, RunTask, TaskState } from './model';
import type { Ownership } from './ownership';
import type { Team } from './team';

const assemblesFolderOf = (importer: string, file: string): boolean =>
  /^index\.[cm]?[jt]sx?$/.test(path.basename(importer)) && path.dirname(importer) === path.dirname(file);

/**
 * A plan, held to the rules: the lead writes it, the CLI never interprets a goal. Refused, every
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
  /** What the plan says it leaves out: said to the person before opening. */
  leftOut: string[];
}

/** Above either, a person confirms the estimate before the run opens. */
export const CONFIRM_ABOVE = { agents: 5, wallMinutes: 120 } as const;

/** Where `file` points, when it — or a folder on its way — is a link: undefined for a file, or for none yet. */
const linkOf = async (root: string, file: string): Promise<string | undefined> => {
  const parts = file.split('/');
  for (let depth = 1; depth <= parts.length; depth += 1) {
    const at = under(root, parts.slice(0, depth).join('/'));
    const stat = await fs.lstat(at).catch(() => undefined);
    if (stat === undefined) {
      return undefined;
    }

    if (stat.isSymbolicLink()) {
      return await fs.readlink(at).catch(() => 'somewhere it cannot read');
    }
  }

  return undefined;
};

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

/** The developers a designer keeps up with: past it, UI reviews queue, and the lead reviews them itself or they wait. */
export const DEVELOPERS_PER_DESIGNER = 3;

/**
 * Too few designers for the UI to review, said before the run starts: la-velada's one designer beside four developers
 * left 21 tasks' UI to the lead. A designer that develops too is counted as a designer: it reviews first.
 */
const designersNotice = (plan: Pick<RunPlan, 'tasks' | 'designReview'>, team: Team): string[] => {
  if (!reviewsDesign(team, plan)) {
    return [];
  }

  const agents = startedAgents(team);
  const designers = agents.filter(each => each.roles.includes(DESIGNER)).length;
  const developers = agents.filter(each => !each.roles.includes(DESIGNER) && each.roles.includes(DEVELOPER)).length;
  const looked = plan.tasks.filter(task => reviewedAsUi(task.role, task.files)).length;
  const needed = Math.ceil(developers / DEVELOPERS_PER_DESIGNER);
  if (looked === 0 || designers >= needed) {
    return [];
  }

  return [
    `${String(looked)} tasks change what a visitor sees, and ${String(designers)} designer${designers === 1 ? '' : 's'} review${designers === 1 ? 's' : ''} the UI of ${String(developers)} developers: one for every ${String(DEVELOPERS_PER_DESIGNER)} keeps the reviews from queueing — ${String(needed)} (plitzi run team set <designer entry> --roles designer --count ${String(needed)}). Fewer, and the lead reviews the rest itself (--skip-design lead) — a task that changes nothing a visitor sees goes as code (task complete --review code)`
  ];
};

const isOutsideSource = (file: string): boolean =>
  NOT_TASK_DIRS.has(file.split('/')[0]) || file.split('/').includes('node_modules');

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
      // A redirection is the shell's, never a page: `2>&1`, `>out.txt` — and `> out.txt`, its target the next word.
      if (/^(\d*|&)(>>?|<)/.test(word)) {
        if (/^(\d*|&)(>>?|<)$/.test(word)) {
          index += 1;
        }

        continue;
      }

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
    } else if (namesServedCopy(check)) {
      const scripts = await scriptsOf(root).catch(() => ({}));
      if (!['start', 'start:dev'].some(name => Object.hasOwn(scripts, name))) {
        problems.push(
          `Task "${task.id}": the check of "${said}" names the copy served ($PLITZI_URL, $PLITZI_PORT), and the project has no start script to serve it with`
        );
      }
    }
  }

  return problems;
};

export const checkPlan = async (
  root: string,
  written: RunPlan,
  ownership: Ownership,
  team: Team,
  /** A stage's: the pieces of the run's inventory, which its lines may cover. */
  knownInventory: ReadonlySet<string> = new Set(),
  /** A stage's: the files the run's approved work holds that the project does not yet — made, not to make. */
  inRunsWork: ReadonlySet<string> = new Set()
): Promise<CheckedPlan> => {
  const agentsAsked = teamSize(team);
  const problems: string[] = [...roleProblems(written, team), ...inventoryProblems(written, knownInventory)];
  const notices: string[] = [];
  // With a tester in the team, each developer task's tests are a task of their own, after it: checked as the lead's.
  const { plan, added, untested } = withTestTasks(
    written,
    teamTakes(team, TESTER)
      ? {
          ...(await testSetupOf(root)),
          unitOf: file => ownership.ownerOf.get(file) ?? (ownership.shared.has(file) ? undefined : file)
        }
      : undefined
  );
  if (added.length > 0) {
    notices.push(
      `A tester writes the tests of the developer tasks: ${added.join(', ')} added, each after the task it tests (a task that says "tests": false gets none)`
    );
  }

  untested.forEach(({ task, why }) =>
    notices.push(
      `"${task}" gets no task of tests: ${why}. Name a test file in a task of yours for it, or say "tests": false — so that none is said, not missed`
    )
  );
  notices.push(...designersNotice(plan, team));
  if (plan.reference !== undefined) {
    notices.push(
      `Its reference, ${plan.reference}, is kept once the run is open — plitzi run reference: each page of the inventory pictured and measured, which page shot --compare measures against for the whole run, not the site as it may change; the run finishing removes it`
    );
  }

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

    // Research alone writes nothing: a task with a spike and no files is done by its findings.
    if (task.files.length === 0 && task.spike === undefined) {
      problems.push(
        `Task "${task.id}" writes no file: name what it writes — or, research alone, what it finds out ("spike": "…")`
      );
    }

    if (task.spike?.trim() === '') {
      problems.push(`Task "${task.id}": its spike says what to find out — it is empty`);
    }

    // Research alone never completes: its findings end it, and a command on its acceptance would never run.
    if (isResearch(task) && task.acceptance.some(each => typeof each !== 'string')) {
      problems.push(
        `Task "${task.id}" is research alone (a spike, no files): its acceptance is what its findings answer, in words — a check runs at complete, which it never reaches`
      );
    }

    if (task.role !== undefined && !ID.test(task.role)) {
      problems.push(
        `Task "${task.id}": its role "${task.role}" is a name — developer, designer, reviewer, tester, writer`
      );
    }

    problems.push(...(await acceptanceProblems(root, task)));
    if (task.acceptance.length === 0) {
      notices.push(
        `Task "${task.id}" says no acceptance: its agent has nothing to be done by, and your review nothing to hold it to — a line each of what makes it done, or { said, check } for one a command proves`
      );
    }
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
  // Two paths that differ only in case are one file where the project is cloned on macOS or Windows.
  const byCase = new Map<string, { file: string; task: string }>();
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

      if (/[*?[\]{}]/.test(file)) {
        problems.push(
          `Task "${task.id}": "${file}" is a pattern, and a task names its files — each one (plitzi space overview lists them)`
        );
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

      const link = await linkOf(root, file);
      if (link !== undefined) {
        problems.push(
          `Task "${task.id}": ${file} is a link (to ${link}): a task writes files, not what a link points at — name the file itself, inside the project`
        );
        continue;
      }

      const other = holder.get(file);
      if (other !== undefined && other !== task.id) {
        problems.push(`${file} is in "${other}" and "${task.id}": one agent per file — give it to one of them`);
      }

      const sameFile = byCase.get(file.toLowerCase());
      if (sameFile && sameFile.file !== file) {
        problems.push(
          `${sameFile.file} ("${sameFile.task}") and ${file} ("${task.id}") differ only in case: one file on macOS and Windows — write it one way${sameFile.task === task.id ? '' : ', in one task'}`
        );
      }

      holder.set(file, task.id);
      byCase.set(file.toLowerCase(), { file, task: task.id });
      // A unit that is a folder (a plugin's) is in the run's work once a file under it is.
      const madeByRun = inRunsWork.has(file) || [...inRunsWork].some(each => each.startsWith(`${file}/`));
      if (!madeByRun && !(await exists(under(root, file))) && !created.includes(file)) {
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
  notices.push(...(await expectationNotices(root, plan.tasks)));
  // What reads a task's file and is in no task: changed under it, never by it — the lead's to plan, or to leave.
  const planned = new Set(tasks.flatMap(task => task.files));
  // One line a file a task changes — a data file read by every page is one notice, not one an importer.
  const SHOWN_IMPORTERS = 6;
  for (const task of tasks) {
    for (const file of task.files) {
      const importers = ownership.importedBy.get(file) ?? [];
      // Imported by another task's files: what it exports is their contract — v12 changed a component's params, and
      // its callers were three other tasks'.
      const theirs = importers
        .filter(importer => holder.get(importer) !== undefined && holder.get(importer) !== task.id)
        .sort();
      if (theirs.length > 0) {
        notices.push(
          `${file} (${task.id}) is imported by the files of other tasks — ${theirs.map(importer => `${importer} (${String(holder.get(importer))})`).join(', ')}: what it exports is theirs to use as it is. Change it compatibly (a new param optional), or say in the plan who follows it (a task after it, or a proposal)`
        );
      }

      // …but its own folder's index: it puts the folder's parts together, and a part's change reaches it only through
      // a name it imports, which the task's typecheck says at complete — la-velada's page index was one notice a part.
      const outside = importers
        .filter(
          importer =>
            !planned.has(importer) && !ownership.entries.includes(importer) && !assemblesFolderOf(importer, file)
        )
        .sort();
      if (outside.length > 0) {
        const named = outside.slice(0, SHOWN_IMPORTERS).join(', ');
        const more = outside.length > SHOWN_IMPORTERS ? ` and ${String(outside.length - SHOWN_IMPORTERS)} more` : '';
        notices.push(
          `${file} (${task.id}) is read by ${String(outside.length)} file${outside.length === 1 ? '' : 's'} no task holds — ${named}${more}: they change with it, as written — give one to a task if it must follow`
        );
      }
    }
  }

  // How much each task asks of its model, where the plan says none: what many build on is worth the strongest; a
  // one-file few minutes, the lightest — said, so the lead sets it otherwise in a line.
  const suggested: string[] = [];
  for (const task of tasks) {
    if (task.quality !== undefined || task.kind !== 'work') {
      continue;
    }

    const builtOn = tasks.filter(other => other.id !== task.id && before(task.id, other.id)).length;
    const importedByOthers = task.files.some(file =>
      (ownership.importedBy.get(file) ?? []).some(
        importer => holder.get(importer) !== undefined && holder.get(importer) !== task.id
      )
    );
    const [quality, why]: [Quality, string] =
      builtOn >= 3 || importedByOthers
        ? ['high', builtOn >= 3 ? `${String(builtOn)} tasks build on it` : 'other tasks import what it writes']
        : task.estimateMinutes <= 10 && task.files.length <= 1
          ? ['light', `${String(task.estimateMinutes)} minutes on one file`]
          : ['standard', ''];
    task.quality = quality;
    if (quality !== 'standard') {
      suggested.push(`${task.id} ${quality} (${why})`);
    }
  }

  if (suggested.length > 0) {
    notices.push(
      `Quality where the plan said none: ${suggested.join(', ')}; the rest standard — an agent started at a level takes tasks of it or below ("quality" in a task sets it otherwise)`
    );
  }

  const pieces = plan.inventory ?? [];
  notices.push(
    pieces.length > 0
      ? `The inventory: ${String(pieces.length)} pieces — ${String(pieces.filter(item => item.leftOut === undefined).length)} covered by a task’s checked acceptance, ${String(pieces.filter(item => item.leftOut !== undefined).length)} left out`
      : 'No inventory: what the job asks is not listed piece by piece, so nothing checks that the tasks cover it — for a copy, a design or a brief, list it ("inventory": [{ id, piece, page }]) and cover each with { said, check, covers }'
  );

  // A task whose acceptance no command proves holds only at its review: a later task can undo it, and nothing says so —
  // v12's print fit one sheet when approved, and two at the finish.
  const unchecked = tasks.filter(
    task =>
      task.kind === 'work' &&
      (task.role ?? DEVELOPER) !== TESTER &&
      task.acceptance.length > 0 &&
      task.acceptance.every(each => typeof each === 'string')
  );
  if (unchecked.length > 0) {
    notices.push(
      `No line of ${unchecked.map(task => `"${task.id}"`).join(', ')}'s acceptance has a check: what it asks holds at its review, and nothing tells when a later task undoes it — give the lines a command can prove { said, check } (a page check, a spec): they run at complete, and again on the whole result at the finish`
    );
  }

  return {
    runId: plan.runId,
    goal: plan.goal,
    leftOut: [...(plan.leftOut ?? []), ...inventoryLeftOut(plan)],
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
 * by urgency (`byUrgency`), then by id — the same input, the same order. A task in spike is no agent's to take: a lead
 * finds out first.
 */
export const readyTasks = (
  tasks: readonly RunTask[],
  states: ReadonlyMap<string, TaskState>,
  held: ReadonlySet<string>
): RunTask[] => {
  const urgency = byUrgency(tasks);

  return tasks
    .filter(task => {
      const status = states.get(task.id)?.status ?? 'pending';

      if (held.has(task.id)) {
        return false;
      }

      return (status === 'pending' || status === 'ready') && dependenciesDone(task, states);
    })
    .sort((a, b) => urgency(a, b) || a.id.localeCompare(b.id));
};
