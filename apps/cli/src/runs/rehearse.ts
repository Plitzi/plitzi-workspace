import { inPageFolder } from './ownership';
import { chainMinutes, PRIORITY_RANK } from './plan';
import { roleOf } from './tasks';

import type { RunTask } from './model';
import type { Ownership } from './ownership';

/**
 * `plitzi run rehearse`: a plan played out before any agent starts — every agent taking the best task it may
 * as `task next` would, each task worked for its estimate, the lead reviewing one at a time, what depends on a task ready
 * once it is approved. No run is opened and nothing is written: what it answers is the schedule the plan implies — how
 * long, who waits for what, which files several tasks change at once, and how many agents are worth starting.
 */

export interface RehearsalOptions {
  agents: number;
  /** Agents held to a role, by role: the rest take any task. */
  roles?: Readonly<Record<string, number>>;
  /** How long the lead takes over one review. */
  reviewMinutes: number;
}

export interface RehearsedTask {
  task: string;
  agent: string;
  role: string;
  /** Minutes from the start: taken, completed (into review), approved. */
  start: number;
  complete: number;
  approved: number;
  /** Ready before it was taken, for want of a free agent of its role. */
  waitedForAgent: number;
  /** In review before the lead got to it, the lead busy with another. */
  waitedForReview: number;
}

export interface RehearsedAgent {
  agent: string;
  /** The role it is held to, or `any`. */
  role: string;
  tasks: string[];
  busyMinutes: number;
  idleMinutes: number;
}

export interface Contention {
  file: string;
  /** The tasks that change it while each other is at work: they meet at `complete`, by turns, merged line by line. */
  tasks: string[];
  /**
   * Whether one holds it while another changes it (`holds`: the other proposes or waits), it is said (`touches`), or
   * read off what the tasks make — a new page registers itself in its entry (`registers`).
   */
  why: 'holds' | 'touches' | 'registers';
  /** The task that holds it, for `holds`. */
  heldBy?: string;
  from: number;
  to: number;
}

export interface Rehearsal {
  agents: number;
  wallMinutes: number;
  criticalPath: { tasks: string[]; minutes: number };
  scheduled: RehearsedTask[];
  team: RehearsedAgent[];
  /** Tasks no agent may take: their role has no agent held to it, and none takes any role. */
  unstaffed: string[];
  /** Tasks never reached because what they wait for is never done. */
  stranded: string[];
  lead: { reviews: number; busyMinutes: number; longestWait: number };
  contention: Contention[];
  /**
   * The whole run's length for each number of agents, from as many as the roles hold to the most worth trying: `null`
   * where some task is never done — no agent may take it.
   */
  scale: { agents: number; wallMinutes: number | null }[];
  advice: string[];
}

const ANY = 'any';

const agentsText = (count: number): string => `${String(count)} agent${count === 1 ? '' : 's'}`;

/** `1 agent finishes`, `3 agents finish`. */
const finishText = (count: number): string => `${agentsText(count)} finish${count === 1 ? 'es' : ''}`;

interface Agent {
  name: string;
  role: string;
  freeAt: number;
  tasks: string[];
  busy: number;
}

interface Played {
  scheduled: RehearsedTask[];
  team: Agent[];
  unstaffed: string[];
  stranded: string[];
  lead: Rehearsal['lead'];
  wallMinutes: number;
}

const teamOf = (agents: number, roles: Readonly<Record<string, number>>): Agent[] => {
  const held = Object.entries(roles).flatMap(([role, count]) => Array.from({ length: count }, () => role));

  return Array.from({ length: agents }, (_, index) => {
    const role = held[index] ?? ANY;

    return { name: `${role === ANY ? 'agent' : role}-${String(index + 1)}`, role, freeAt: 0, tasks: [], busy: 0 };
  });
};

/** One play of the plan: events in order — a task completed, a review ended — and every free agent given work between. */
const play = (tasks: readonly RunTask[], options: RehearsalOptions): Played => {
  const chains = chainMinutes(tasks);
  const order = (a: RunTask, b: RunTask): number =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (chains.get(b.id) ?? 0) - (chains.get(a.id) ?? 0) ||
    a.id.localeCompare(b.id);
  const team = teamOf(options.agents, options.roles ?? {});
  const approvedAt = new Map<string, number>();
  const readyAt = new Map<string, number>();
  const taken = new Set<string>();
  const scheduled: RehearsedTask[] = [];
  // What came in for review, in the order it came, and the one the lead is on.
  const queue: RehearsedTask[] = [];
  let reviewing: RehearsedTask | undefined;
  const staffed = (task: RunTask): boolean => team.some(agent => agent.role === ANY || agent.role === roleOf(task));
  const unstaffed = tasks.filter(task => !staffed(task)).map(task => task.id);
  let leadBusy = 0;
  let longestWait = 0;
  let now = 0;

  const markReady = (): void => {
    for (const task of tasks) {
      if (!readyAt.has(task.id) && task.dependsOn.every(dependency => approvedAt.has(dependency))) {
        readyAt.set(task.id, Math.max(0, ...task.dependsOn.map(dependency => approvedAt.get(dependency) ?? 0)));
      }
    }
  };

  /** What happens at `now`, until nothing more does: an approval, the next review begun, free agents given work. */
  const settle = (): void => {
    for (let changed = true; changed;) {
      changed = false;
      if (reviewing && reviewing.approved <= now) {
        approvedAt.set(reviewing.task, reviewing.approved);
        reviewing = undefined;
        markReady();
        changed = true;
      }

      const due = queue.findIndex(task => task.complete <= now);
      if (!reviewing && due !== -1) {
        const next = queue.splice(due, 1).at(0);
        if (next) {
          next.waitedForReview = now - next.complete;
          next.approved = now + options.reviewMinutes;
          longestWait = Math.max(longestWait, next.waitedForReview);
          leadBusy += options.reviewMinutes;
          reviewing = next;
          changed = true;
        }
      }

      for (const agent of team.filter(each => each.freeAt <= now)) {
        const next = tasks
          .filter(task => !taken.has(task.id) && (readyAt.get(task.id) ?? Infinity) <= now)
          .filter(task => agent.role === ANY || agent.role === roleOf(task))
          .sort(order)
          .at(0);
        if (!next) {
          continue;
        }

        taken.add(next.id);
        const played: RehearsedTask = {
          task: next.id,
          agent: agent.name,
          role: roleOf(next),
          start: now,
          complete: now + next.estimateMinutes,
          approved: Infinity,
          waitedForAgent: now - (readyAt.get(next.id) ?? now),
          waitedForReview: 0
        };
        scheduled.push(played);
        queue.push(played);
        queue.sort((a, b) => a.complete - b.complete || a.task.localeCompare(b.task));
        agent.freeAt = played.complete;
        agent.busy += next.estimateMinutes;
        agent.tasks.push(next.id);
        changed = true;
      }
    }
  };

  markReady();
  for (;;) {
    settle();
    const upcoming = [
      ...(reviewing ? [reviewing.approved] : queue.map(task => task.complete)),
      ...team.map(agent => agent.freeAt)
    ].filter(at => at > now);
    if (upcoming.length === 0) {
      break;
    }

    now = Math.min(...upcoming);
  }

  const stranded = tasks
    .filter(task => !taken.has(task.id) && !unstaffed.includes(task.id))
    .map(task => task.id)
    .sort();
  const wallMinutes = Math.max(0, ...scheduled.map(task => task.approved));

  return {
    scheduled: scheduled.sort((a, b) => a.start - b.start || a.task.localeCompare(b.task)),
    team,
    unstaffed: unstaffed.sort(),
    stranded,
    lead: { reviews: scheduled.length, busyMinutes: leadBusy, longestWait },
    wallMinutes
  };
};

/** The chain of estimates the run cannot be shorter than: from the root that starts the longest, down its longest. */
const criticalPathOf = (tasks: readonly RunTask[]): Rehearsal['criticalPath'] => {
  const chains = chainMinutes(tasks);
  const longest = (candidates: readonly RunTask[]): RunTask | undefined =>
    [...candidates].sort((a, b) => (chains.get(b.id) ?? 0) - (chains.get(a.id) ?? 0) || a.id.localeCompare(b.id))[0];
  const path: string[] = [];
  let at = longest(tasks.filter(task => task.dependsOn.length === 0));
  while (at) {
    path.push(at.id);
    const from = at.id;
    at = longest(tasks.filter(task => task.dependsOn.includes(from)));
  }

  return { tasks: path, minutes: chains.get(path[0] ?? '') ?? 0 };
};

/**
 * What each task will change beyond its own files: what it says it touches, and the entry a page it makes registers in —
 * the entry above it, the nearest one whose folder holds it.
 */
type Change = 'own' | 'touches' | 'registers';

const changesOf = (task: RunTask, ownership: Ownership, created: readonly string[]): Map<string, Change> => {
  const changes = new Map<string, Change>();
  for (const file of task.files) {
    changes.set(file, 'own');
  }

  for (const file of (task.touches ?? []).filter(each => !changes.has(each))) {
    changes.set(file, 'touches');
  }

  // A page made in a folder the project loads its pages from registers nowhere: it is a page by being there.
  for (const file of task.files.filter(each => created.includes(each) && !inPageFolder(ownership, each))) {
    const entry = ownership.entries
      .filter(each => file.startsWith(each.slice(0, each.lastIndexOf('/') + 1)))
      .sort((a, b) => b.length - a.length)[0];
    if (entry && !task.files.includes(entry) && !changes.has(entry)) {
      changes.set(entry, 'registers');
    }
  }

  return changes;
};

const contentionOf = (
  scheduled: readonly RehearsedTask[],
  tasks: readonly RunTask[],
  ownership: Ownership,
  created: readonly string[]
): Contention[] => {
  const byFile = new Map<string, { task: RehearsedTask; why: Change }[]>();
  for (const played of scheduled) {
    const task = tasks.find(each => each.id === played.task);
    if (!task) {
      continue;
    }

    for (const [file, why] of changesOf(task, ownership, created)) {
      byFile.set(file, [...(byFile.get(file) ?? []), { task: played, why }]);
    }
  }

  const found: Contention[] = [];
  for (const [file, changes] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
    const together = changes.filter(change =>
      changes.some(
        other => other !== change && other.task.start < change.task.complete && change.task.start < other.task.complete
      )
    );
    const holder = together.find(change => change.why === 'own');
    if (together.length > 1) {
      found.push({
        file,
        tasks: together.map(change => change.task.task).sort(),
        why: holder ? 'holds' : together.some(change => change.why === 'touches') ? 'touches' : 'registers',
        ...(holder ? { heldBy: holder.task.task } : {}),
        from: Math.min(...together.map(change => change.task.start)),
        to: Math.max(...together.map(change => change.task.complete))
      });
    }
  }

  return found;
};

export const rehearse = (
  tasks: readonly RunTask[],
  options: RehearsalOptions,
  { ownership, created }: { ownership: Ownership; created: readonly string[] }
): Rehearsal => {
  const played = play(tasks, options);
  const criticalPath = criticalPathOf(tasks);
  const held = Object.values(options.roles ?? {}).reduce((sum, count) => sum + count, 0);
  const most = Math.min(Math.max(options.agents, tasks.length), 8);
  const scale = Array.from({ length: most }, (_, index) => index + 1)
    .filter(agents => agents >= held)
    .map(agents => {
      const each = play(tasks, { ...options, agents });

      return { agents, wallMinutes: each.unstaffed.length + each.stranded.length > 0 ? null : each.wallMinutes };
    });
  const team: RehearsedAgent[] = played.team.map(agent => ({
    agent: agent.name,
    role: agent.role,
    tasks: agent.tasks,
    busyMinutes: agent.busy,
    idleMinutes: Math.max(0, played.wallMinutes - agent.busy)
  }));
  const contention = contentionOf(played.scheduled, tasks, ownership, created);
  const advice: string[] = [];
  // The fewest agents that finish as soon as those asked, and the fewest that finish soonest of all.
  const finishing = scale.flatMap(each =>
    each.wallMinutes === null ? [] : [{ ...each, wallMinutes: each.wallMinutes }]
  );
  const fewest = finishing.find(each => each.wallMinutes <= played.wallMinutes);
  const soonest = finishing.reduce<(typeof finishing)[number] | undefined>(
    (min, each) => (min === undefined || each.wallMinutes < min.wallMinutes ? each : min),
    undefined
  );
  const finished = played.unstaffed.length + played.stranded.length === 0;
  if (finished && fewest && fewest.agents < options.agents) {
    advice.push(
      `${finishText(fewest.agents)} as soon as ${String(options.agents)} (${String(played.wallMinutes)} min): the others would wait`
    );
  }

  if (soonest && (!finished || soonest.wallMinutes < played.wallMinutes)) {
    advice.push(
      `${agentsText(soonest.agents)} would finish in ${String(soonest.wallMinutes)} min${finished ? ` instead of ${String(played.wallMinutes)}` : ''}`
    );
  }

  const longestTask = [...tasks]
    .filter(task => criticalPath.tasks.includes(task.id))
    .sort((a, b) => b.estimateMinutes - a.estimateMinutes)
    .at(0);
  if (longestTask && criticalPath.minutes >= played.wallMinutes * 0.8) {
    advice.push(
      `The critical path decides the run (${criticalPath.tasks.join(' → ')}, ${String(criticalPath.minutes)} min of ${String(played.wallMinutes)}): more agents do not shorten it — split ${longestTask.id} (${String(longestTask.estimateMinutes)} min) or let what waits for it start sooner`
    );
  }

  if (played.lead.longestWait >= options.reviewMinutes * 2) {
    advice.push(
      `Reviews queue up — one waited ${String(played.lead.longestWait)} min for the lead: lighter reviews (executable acceptance), or tasks that finish less at once`
    );
  }

  contention
    .filter(each => each.why === 'registers')
    .forEach(each =>
      advice.push(
        `${each.file} is where ${each.tasks.join(', ')} register what they make, at once: they merge line by line when each is on a line of its own — or let the pages register themselves by folder`
      )
    );
  // Agents held to a role wait when their role has nothing ready: the same team, none held, may finish sooner.
  if (held > 0) {
    const free = play(tasks, { ...options, roles: {} });
    const freeFinished = free.unstaffed.length + free.stranded.length === 0;
    if (freeFinished && (!finished || free.wallMinutes < played.wallMinutes)) {
      advice.push(
        `With no agent held to a role, ${finishText(options.agents)} in ${String(free.wallMinutes)} min${finished ? ` instead of ${String(played.wallMinutes)}` : ''}: hold one to a role only when its tasks need it (--roles)`
      );
    }
  }

  if (played.unstaffed.length > 0) {
    advice.push(
      `No agent may take ${played.unstaffed.join(', ')}: give their role an agent (--roles), or leave an agent free of a role`
    );
  }

  return {
    agents: options.agents,
    wallMinutes: played.wallMinutes,
    criticalPath,
    scheduled: played.scheduled,
    team,
    unstaffed: played.unstaffed,
    stranded: played.stranded,
    lead: played.lead,
    contention,
    scale,
    advice
  };
};

const span = (from: number, to: number): string => `${String(from)}–${String(to)}`;

const contentionWhy = (contention: Contention): string =>
  contention.why === 'holds'
    ? `${String(contention.heldBy)} holds it while the others change it: they propose to it or wait`
    : contention.why === 'touches'
      ? 'they say they touch it'
      : 'what they make registers there';

export const rehearsalText = (runId: string, rehearsal: Rehearsal, reviewMinutes: number): string =>
  [
    `Rehearsal of "${runId}" with ${agentsText(rehearsal.agents)} and ${String(reviewMinutes)} min a review: about ${String(rehearsal.wallMinutes)} min to the last approval — nothing opened, nothing written.`,
    '',
    'Who works what (minutes from the start: worked, then approved)',
    ...rehearsal.team.map(
      agent =>
        `  ${agent.agent}${agent.role === ANY ? '' : ` (${agent.role} only)`}: ${
          agent.tasks.length === 0
            ? 'nothing'
            : agent.tasks
                .map(id => {
                  const task = rehearsal.scheduled.find(each => each.task === id);

                  return task ? `${id} ${span(task.start, task.complete)} → ${String(task.approved)}` : id;
                })
                .join(', ')
        } — idle ${String(agent.idleMinutes)} min`
    ),
    `Critical path: ${rehearsal.criticalPath.tasks.join(' → ')} (${String(rehearsal.criticalPath.minutes)} min of work)`,
    `The lead: ${String(rehearsal.lead.reviews)} reviews, ${String(rehearsal.lead.busyMinutes)} min${rehearsal.lead.longestWait > 0 ? `; the longest a task waited for one: ${String(rehearsal.lead.longestWait)} min` : ''}`,
    ...rehearsal.scheduled
      .filter(task => task.waitedForAgent > 0)
      .map(
        task =>
          `  · ${task.task} was ready ${String(task.waitedForAgent)} min before an agent that may take it was free`
      ),
    ...(rehearsal.contention.length > 0
      ? [
          'Files changed by several tasks at once — they meet at complete, by turns, merged line by line',
          ...rehearsal.contention.map(
            each => `  ${each.file}: ${each.tasks.join(', ')} (${contentionWhy(each)}, min ${span(each.from, each.to)})`
          )
        ]
      : []),
    ...(rehearsal.unstaffed.length > 0 ? [`No agent may take: ${rehearsal.unstaffed.join(', ')}`] : []),
    ...(rehearsal.stranded.length > 0 ? [`Never reached: ${rehearsal.stranded.join(', ')}`] : []),
    `By agents: ${rehearsal.scale.map(each => `${String(each.agents)} → ${each.wallMinutes === null ? 'never all done' : `${String(each.wallMinutes)} min`}`).join(', ')}`,
    ...rehearsal.advice.map(line => `  → ${line}`),
    'A rehearsal counts each task its estimate and one review; rounds of changes, questions and checks add to it.'
  ].join('\n');
