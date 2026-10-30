import { isRecord } from '@plitzi/sdk-shared/helpers';

import { clock, evidenceOf, strings, text } from './types';
import { projectRun } from '../../scaffold/packageManager';
import { BUSY_TIMEOUTS } from '../copies/busy';
import { brokenNamedIn } from '../core/acceptedOn';

import type { Finding, LogEntry } from './types';

/**
 * What the run's checks say of the checks themselves: one that answers two ways on the same work, an acceptance line
 * failing try after try (four lines × four tries, all the lead's), a step an agent ran
 * again rather than read, a task breaking what another was approved on, and lines rewritten once the run had begun.
 */

const ACCEPTANCE = 'acceptance — ';

/** A line failing this many checks of one task is the line's, or a task stuck on it — said while it happens. */
const LINE_FAILS = 3;

/** A step of the project's failing this many checks of one task: run again rather than read. */
const STEP_FAILS = 4;

const checksOf = (log: readonly LogEntry[]): LogEntry[] => log.filter(entry => entry.action === 'check');

/** What a check said of one of its failing steps (its `why`): the last lines, why it failed. */
const whySaid = (check: LogEntry, step: string): string[] =>
  strings((Array.isArray(check.why) ? check.why.filter(isRecord) : []).find(each => each.step === step)?.said).slice(
    -3
  );

/** One input — the copy, the run's work, the lines, the CLI (`checkKey`) — checked twice with two answers. */
export const flakyChecks = (log: readonly LogEntry[]): Finding[] => {
  const byInput = new Map<string, LogEntry[]>();
  for (const check of checksOf(log)) {
    const input = text(check.input);
    if (input !== '') {
      const key = `${text(check.task)}\u0000${input}\u0000${text(check.only)}`;
      byInput.set(key, [...(byInput.get(key) ?? []), check]);
    }
  }

  return [...byInput.values()].flatMap(checks => {
    const answers = new Set(checks.map(check => strings(check.failed).sort().join('\u0000')));
    if (answers.size < 2) {
      return [];
    }

    const task = text(checks[0].task);
    const failedSome = new Set(checks.flatMap(check => strings(check.failed)));
    const failedAll = [...failedSome].filter(step => checks.every(check => strings(check.failed).includes(step)));
    const changing = [...failedSome].filter(step => !failedAll.includes(step));
    const lines = changing.every(step => step.startsWith(ACCEPTANCE));

    return [
      {
        kind: 'flaky-check' as const,
        owner: lines ? ('lead' as const) : ('plitzi' as const),
        ...(lines ? {} : { area: 'cli' as const }),
        title: `${task}'s checks answered ${String(answers.size)} ways on the same work: ${changing.join(', ')}`,
        evidence: evidenceOf(
          checks.map(
            check => `${clock(check.at)} ${check.ok === true ? 'passed' : `failed ${strings(check.failed).join(', ')}`}`
          )
        ),
        times: checks.length,
        fix: lines
          ? 'a line that reads what changes on its own — the time, a race, a server still starting — waits for what it checks, or checks what holds'
          : 'a step that answers differently on the same files: its cache, or what it reads outside them',
        subject: `flaky:${task}:${changing.join(',')}`,
        live: true
      }
    ];
  });
};

/** Each acceptance line of a task that failed its checks `LINE_FAILS` times or more, where it was the task's to pass. */
export const linesFailing = (log: readonly LogEntry[]): Finding[] => {
  const counted = new Map<string, { task: string; line: string; at: string[]; inputs: Set<string>; said: string[] }>();
  for (const check of checksOf(log)) {
    const notOwn = strings(check.notOwn);
    for (const failed of strings(check.failed)) {
      if (!failed.startsWith(ACCEPTANCE) || notOwn.includes(failed)) {
        continue;
      }

      const key = `${text(check.task)}\u0000${failed}`;
      const kept = counted.get(key) ?? {
        task: text(check.task),
        line: failed.slice(ACCEPTANCE.length),
        at: [],
        inputs: new Set(),
        said: []
      };
      kept.at.push(clock(check.at));
      kept.inputs.add(text(check.input));
      kept.said = whySaid(check, failed).length > 0 ? whySaid(check, failed) : kept.said;
      counted.set(key, kept);
    }
  }

  return [...counted.values()]
    .filter(each => each.at.length >= LINE_FAILS)
    .map(each => ({
      kind: 'line-failing' as const,
      owner: 'lead' as const,
      title: `${each.task}: "${each.line}" failed ${String(each.at.length)} checks`,
      // How many versions of the work it failed on, where the checks said what they ran on (`input`).
      evidence: [
        `failed at ${each.at.join(', ')}`,
        ...(each.inputs.has('') ? [] : [`on ${String(each.inputs.size)} different version(s) of the work`]),
        ...each.said.map(line => `it said: ${line}`)
      ],
      times: each.at.length,
      fix: 'run the line on the run’s work and the copy (run open <stage> --dry-run --lines, task check --acceptance): a line that cannot pass is amended (run amend), one the work misses is said to the agent',
      subject: `line:${each.task}:${each.line}`,
      task: each.task,
      live: true as const
    }));
};

/** A step of the project's — author, lint, typecheck — failing again and again on one task: run, not read. */
export const stepsFailing = (log: readonly LogEntry[]): Finding[] => {
  const counted = new Map<string, { task: string; step: string; by: Set<string>; times: number; said: string[] }>();
  for (const check of checksOf(log)) {
    const notOwn = strings(check.notOwn);
    for (const failed of strings(check.failed)) {
      if (failed.startsWith(ACCEPTANCE) || notOwn.includes(failed)) {
        continue;
      }

      const key = `${text(check.task)}\u0000${failed}`;
      const kept = counted.get(key) ?? { task: text(check.task), step: failed, by: new Set(), times: 0, said: [] };
      kept.times += 1;
      kept.by.add(text(check.by));
      kept.said = whySaid(check, failed).length > 0 ? whySaid(check, failed) : kept.said;
      counted.set(key, kept);
    }
  }

  return [...counted.values()]
    .filter(each => each.times >= STEP_FAILS)
    .map(each => ({
      kind: 'step-failing' as const,
      owner: 'agent' as const,
      title: `${each.task}: ${each.step} failed ${String(each.times)} checks`,
      evidence: [`by ${[...each.by].join(', ')}`, ...each.said.map(line => `it said: ${line}`)],
      times: each.times,
      fix: `read what ${each.step} says before checking again — task check --fix for lint and format; ${projectRun('author')} for the space's own`,
      subject: `step:${each.task}:${each.step}`
    }));
};

/** Why a task's acceptance was rewritten once the run had begun, read off what came before it. */
type AmendCause = 'unworked' | 'broke-approved' | 'check' | 'lead';

interface Amended {
  at: string;
  task: string;
  cause: AmendCause;
  /** What showed the cause, for a line the lead did not write wrong. */
  said?: string;
}

/** Each acceptance amended, with why: a line rewritten has as many causes as there are ways a run meets it. */
const amendedLines = (log: readonly LogEntry[]): Amended[] =>
  log.flatMap(entry =>
    entry.action === 'amend' && Array.isArray(entry.tasks)
      ? entry.tasks.flatMap((each: unknown): Amended[] => {
          if (!isRecord(each) || typeof each.task !== 'string' || !strings(each.changed).includes('acceptance')) {
            return [];
          }

          const at = text(entry.at);
          const task = each.task;
          const before = log.filter(other => text(other.at) < at);
          const taken = before.findLast(other => other.action === 'take' && other.task === task);
          // Rewritten before anyone worked to it — the approval of a proposal amending what it stacks — cost nobody a round.
          if (taken === undefined) {
            return [{ at, task, cause: 'unworked' }];
          }

          const broke = before.findLast(
            other => other.action === 'refused' && brokenNamedIn(text(other.message))?.includes(task) === true
          );
          if (broke !== undefined) {
            return [{ at, task, cause: 'broke-approved', said: text(broke.message) }];
          }

          const since = before.filter(other => text(other.at) >= text(taken.at));
          const unanswered = since.findLast(other => other.action === 'check' && other.task === task)?.notOwn;
          const unread = strings(unanswered).find(line => line.startsWith(ACCEPTANCE));
          const noticed = since.findLast(
            other => other.action === 'notice' && other.about === 'plitzi' && other.task === task
          );
          if (unread !== undefined || noticed !== undefined) {
            return [
              {
                at,
                task,
                cause: 'check',
                said: noticed === undefined ? `nothing could answer ${unread ?? ''}` : text(noticed.text)
              }
            ];
          }

          return [{ at, task, cause: 'lead' }];
        })
      : []
  );

/**
 * A task whose change broke what an approved task was accepted on: found at its complete, or at the finish — with the
 * approved tasks' lines amended for it, which are this, not lines written wrong.
 */
export const brokeApproved = (log: readonly LogEntry[]): Finding[] => {
  // Lines that only ran out of time on a busy machine broke nothing (`BUSY_TIMEOUTS`): a run's report blamed the
  // tasks' changes for two finishes the machine's load refused.
  const broke = log.filter(
    entry =>
      entry.action === 'refused' &&
      brokenNamedIn(text(entry.message)) !== undefined &&
      !text(entry.message).includes(BUSY_TIMEOUTS)
  );
  const amended = amendedLines(log).filter(each => each.cause === 'broke-approved');

  return broke.length === 0
    ? []
    : [
        {
          kind: 'broke-approved',
          owner: 'lead',
          title: 'Changes broke what approved tasks were accepted on',
          evidence: evidenceOf([
            ...broke.map(entry => `${clock(entry.at)} ${text(entry.by)}: ${text(entry.message).slice(0, 220)}`),
            ...amended.map(each => `${clock(each.at)} ${each.task}'s acceptance amended for it`)
          ]),
          times: broke.length,
          fix: 'a task that changes another’s page on purpose says so in its brief, and the lead amends that task’s lines with it',
          subject: 'broke-approved'
        }
      ];
};

/**
 * Acceptance lines rewritten once a task was worked to: the lead's, a line written before it was run — or Plitzi's, a
 * line its check could not read (a false reading noticed, a line nothing answered). One amended before anyone worked
 * it, or for what another task broke (`brokeApproved`), is neither: counted all as the lead's, under one fix, the finding
 * came back run after run for six amendments that fix would have spared one of.
 */
export const linesAmended = (log: readonly LogEntry[]): Finding[] => {
  const amended = amendedLines(log);
  const lead = amended.filter(each => each.cause === 'lead');
  const check = amended.filter(each => each.cause === 'check');

  return [
    ...(lead.length === 0
      ? []
      : [
          {
            kind: 'lines-amended' as const,
            owner: 'lead' as const,
            title: `${String(lead.length)} tasks’ acceptance rewritten after work on them began`,
            evidence: evidenceOf(lead.map(each => `${clock(each.at)} ${each.task}`)),
            times: lead.length,
            fix: 'each line run once before the stage is stacked: run open <stage.json> --dry-run --lines',
            subject: 'lines-amended'
          }
        ]),
    ...(check.length === 0
      ? []
      : [
          {
            kind: 'lines-amended' as const,
            owner: 'plitzi' as const,
            area: 'cli' as const,
            title: `${String(check.length)} tasks’ acceptance rewritten around a check that could not read it`,
            evidence: evidenceOf(
              check.map(each => `${clock(each.at)} ${each.task}: ${(each.said ?? '').slice(0, 200)}`)
            ),
            times: check.length,
            fix: 'the check reads the line as it is written: what kept it from reading it is the fix, not the line',
            subject: 'lines-amended-check'
          }
        ])
  ];
};
