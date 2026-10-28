import { clock, evidenceOf, text } from './types';

import type { Finding, LogEntry } from './types';
import type { UsageLine } from '../core/usage';

/**
 * How the run's agents held their tasks and their sessions, replayed from the log and the usage — the state the CLI
 * keeps, checked against what it should never be. A run's: dev-1 handed t-shell while it held t-player (one session,
 * two tasks); dev-1 sent back two tasks at once (the lead reassigned one by hand); dev-2 started again while its last
 * session was still writing (#44).
 */

/**
 * An agent with two tasks in progress at once: replayed take by take, each time it happened said once. A task blocked
 * frees its agent; one sent back — or unblocked — while its agent is at another waits for it — Carlos's rule: never handed to a free one — and is its
 * agent's work again once the other is complete; counted then, never while it waits (a run said dev-1 held two).
 */
export const twoTasks = (log: readonly LogEntry[]): Finding[] => {
  const owner = new Map<string, string>();
  const working = new Map<string, Set<string>>();
  const waiting = new Map<string, Set<string>>();
  const seen = new Map<string, string[]>();
  const setOf = (sets: Map<string, Set<string>>, agent: string): Set<string> => {
    const held = sets.get(agent) ?? new Set<string>();
    sets.set(agent, held);

    return held;
  };
  // Its own work done or handed on, a sent-back task waiting for it is what it is at next.
  const nextOwn = (agent: string): void => {
    const first = [...setOf(waiting, agent)].at(0);
    if (setOf(working, agent).size === 0 && first !== undefined) {
      setOf(waiting, agent).delete(first);
      setOf(working, agent).add(first);
    }
  };

  for (const entry of log) {
    const task = text(entry.task);
    const by = text(entry.by);
    if (entry.action === 'take') {
      owner.set(task, by);
      setOf(waiting, by).delete(task);
      setOf(working, by).add(task);
    } else if (entry.action === 'complete') {
      setOf(working, by).delete(task);
      nextOwn(by);
    } else if (entry.action === 'block') {
      // Blocked, its agent is free for another: the block is no task at work.
      const holder = owner.get(task);
      if (holder !== undefined) {
        setOf(working, holder).delete(task);
        nextOwn(holder);
      }
    } else if ((entry.action === 'review' && entry.verdict === 'changes') || entry.action === 'unblock') {
      // Sent back, or unblocked, while its agent is at another: it waits for it, handed back by its next `task next`.
      const holder = owner.get(task);
      if (holder !== undefined && !setOf(working, holder).has(task)) {
        setOf(waiting, holder).add(task);
        nextOwn(holder);
      }
    } else if (entry.action === 'reassign') {
      const from = text(entry.from);
      setOf(working, from).delete(task);
      setOf(waiting, from).delete(task);
      nextOwn(from);
      owner.set(task, text(entry.to));
      setOf(working, text(entry.to)).add(task);
    } else {
      continue;
    }

    for (const [agent, held] of working) {
      if (held.size > 1 && !agent.startsWith('lead')) {
        const pair = [...held].sort().join(' + ');
        const times = seen.get(agent) ?? [];
        if (!times.some(each => each.startsWith(pair))) {
          seen.set(agent, [...times, `${pair}, from ${clock(entry.at)}`]);
        }
      }
    }
  }

  return [...seen].map(([agent, pairs]) => ({
    kind: 'two-tasks',
    owner: 'plitzi',
    area: 'cli',
    title: `${agent} had two tasks in progress at once`,
    evidence: evidenceOf(pairs),
    times: pairs.length,
    fix: 'one task in progress an agent: another is taken once its own is complete — one sent back waits for it, and is what it takes next',
    subject: `two-tasks:${agent}`,
    live: true
  }));
};

/** What an agent may still run once told it can stop: what its prompt asks of a stopping agent. */
// What an agent says on its way out is no work: a notice of Plitzi, its inbox read, and what it tells the lead beyond
// the piece just ended — a reviewer told by its verdict to stop told the lead two things it found, and read "went on".
const STOPPING = ['run notice', 'task next', 'task inbox', 'task tell'];

/** Commands an agent ran in the same session after the run told it to stop (`stops`). */
export const afterStop = (log: readonly LogEntry[], usage: readonly UsageLine[]): Finding[] => {
  const findings: Finding[] = [];
  const stops = log.filter(entry => entry.action === 'stops');
  for (const agent of new Set(stops.map(entry => text(entry.by)))) {
    const lines = usage.filter(line => line.by === agent && line.session !== undefined);
    const went: string[] = [];
    for (const stop of stops.filter(entry => entry.by === agent)) {
      const at = text(stop.at);
      const session = lines.findLast(line => line.at <= at)?.session;
      const next = lines.find(line => line.at > at && line.session !== session);
      // Started again on the same session (`resumeSession`): what follows is the new start's, not the stopped one's.
      const resumed = text(
        log.find(entry => entry.action === 'launch' && entry.agent === agent && text(entry.at) > at)?.at
      );
      const after = lines.filter(
        line =>
          line.at > at &&
          line.session === session &&
          (next === undefined || line.at < next.at) &&
          (resumed === '' || line.at < resumed) &&
          !STOPPING.includes(line.name)
      );
      if (session !== undefined && after.length > 0) {
        went.push(
          `stopped at ${clock(at)}, then ${String(after.length)} command(s): ${after[0].command.slice(0, 80)}…`
        );
      }
    }

    if (went.length > 0) {
      findings.push({
        kind: 'after-stop',
        owner: 'agent',
        title: `${agent} went on in the same session after the run told it to stop`,
        evidence: evidenceOf(went),
        times: went.length,
        fix: 'its prompt: "You can stop" ends the session — a notice of Plitzi is its last command',
        subject: `after-stop:${agent}`,
        live: true
      });
    }
  }

  return findings;
};

/** How close two sessions' commands must be to read as both alive. */
const OVERLAP_MS = 5 * 60_000;

/** One agent in two sessions at once: commands of one between commands of another, minutes apart. */
export const twoSessions = (usage: readonly UsageLine[]): Finding[] => {
  const findings: Finding[] = [];
  for (const agent of new Set(usage.map(line => line.by))) {
    if (agent === 'unnamed') {
      continue;
    }

    const lines = usage.filter(line => line.by === agent && line.session !== undefined);
    const overlaps: string[] = [];
    for (let index = 2; index < lines.length; index += 1) {
      const [a, b, c] = [lines[index - 2], lines[index - 1], lines[index]];
      if (
        a.session === c.session &&
        a.session !== b.session &&
        Date.parse(c.at) - Date.parse(a.at) < OVERLAP_MS &&
        !overlaps.some(each => each.includes(text(b.session).slice(0, 8)))
      ) {
        overlaps.push(
          `${text(a.session).slice(0, 8)} and ${text(b.session).slice(0, 8)} both ran commands around ${clock(b.at)}`
        );
      }
    }

    if (overlaps.length > 0) {
      findings.push({
        kind: 'two-sessions',
        owner: 'plitzi',
        area: 'cli',
        title: `${agent} ran in two sessions at once`,
        evidence: evidenceOf(overlaps),
        times: overlaps.length,
        fix: 'an agent is started again only once its last session has ended: run agent --launch checks its process',
        subject: `two-sessions:${agent}`,
        live: true
      });
    }
  }

  return findings;
};
