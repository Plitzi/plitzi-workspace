import { clock, evidenceOf, text } from './types';

import type { Finding, LogEntry } from './types';
import type { UsageLine } from '../usage';

/**
 * How the run's agents held their tasks and their sessions, replayed from the log and the usage — the state the CLI
 * keeps, checked against what it should never be. Encore's: dev-1 handed t-shell while it held t-player (one session,
 * two tasks); dev-1 sent back two tasks at once (the lead reassigned one by hand); dev-2 started again while its last
 * session was still writing (#44).
 */

/** An agent with two tasks in progress at once: replayed take by take, each time it happened said once. */
export const twoTasks = (log: readonly LogEntry[]): Finding[] => {
  const owner = new Map<string, string>();
  const working = new Map<string, Set<string>>();
  const seen = new Map<string, string[]>();
  const of = (agent: string): Set<string> => {
    const held = working.get(agent) ?? new Set<string>();
    working.set(agent, held);

    return held;
  };

  for (const entry of log) {
    const task = text(entry.task);
    const by = text(entry.by);
    if (entry.action === 'take') {
      owner.set(task, by);
      of(by).add(task);
    } else if (entry.action === 'complete') {
      of(by).delete(task);
    } else if (entry.action === 'review' && entry.verdict === 'changes') {
      const holder = owner.get(task);
      if (holder !== undefined) {
        of(holder).add(task);
      }
    } else if (entry.action === 'reassign') {
      of(text(entry.from)).delete(task);
      owner.set(task, text(entry.to));
      of(text(entry.to)).add(task);
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
    fix: 'one task in progress an agent: a second sent back to a busy agent is offered to a free one of its role, not stacked on it',
    subject: `two-tasks:${agent}`,
    live: true
  }));
};

/** What an agent may still run once told it can stop: what its prompt asks of a stopping agent. */
const STOPPING = ['plitzi run notice', 'plitzi task next', 'plitzi task inbox'];

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
          !STOPPING.some(command => line.command.startsWith(command))
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
