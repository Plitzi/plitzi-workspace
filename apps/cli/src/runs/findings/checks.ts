import { isRecord } from '@plitzi/sdk-shared/helpers';

import { clock, evidenceOf, strings, text } from './types';

import type { Finding, LogEntry } from './types';

/**
 * What the run's checks say of the checks themselves: one that answers two ways on the same work, an acceptance line
 * failing try after try (lx-product's t-gallery-phone: four lines × four tries, all the lead's), a step an agent ran
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
      fix: 'run the line on the run’s work and the copy (run extend --dry-run --lines, task check --acceptance): a line that cannot pass is amended (run amend), one the work misses is said to the agent',
      subject: `line:${each.task}:${each.line}`,
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
      fix: `read what ${each.step} says before checking again — task check --fix for lint and format; npm run author for the space's own`,
      subject: `step:${each.task}:${each.step}`
    }));
};

/** A task whose change broke what an approved task was accepted on: found at its complete, or at the finish. */
export const brokeApproved = (log: readonly LogEntry[]): Finding[] => {
  const broke = log.filter(
    entry =>
      entry.action === 'refused' &&
      /accepted on/.test(text(entry.message)) &&
      /no longer holds|breaks/.test(text(entry.message))
  );

  return broke.length === 0
    ? []
    : [
        {
          kind: 'broke-approved',
          owner: 'lead',
          title: 'Changes broke what approved tasks were accepted on',
          evidence: evidenceOf(
            broke.map(entry => `${clock(entry.at)} ${text(entry.by)}: ${text(entry.message).slice(0, 220)}`)
          ),
          times: broke.length,
          fix: 'a task that changes another’s page on purpose says so in its brief, and the lead amends that task’s lines with it',
          subject: 'broke-approved'
        }
      ];
};

/** Acceptance lines rewritten after the run began: each one a line that was written before it was run. */
export const linesAmended = (log: readonly LogEntry[]): Finding[] => {
  const amended = log.flatMap(entry =>
    entry.action === 'amend' && Array.isArray(entry.tasks)
      ? entry.tasks.flatMap((each: unknown) =>
          typeof each === 'object' && each !== null && 'changed' in each && strings(each.changed).includes('acceptance')
            ? [`${clock(entry.at)} ${'task' in each ? text(each.task) : ''}`]
            : []
        )
      : []
  );

  return amended.length === 0
    ? []
    : [
        {
          kind: 'lines-amended',
          owner: 'lead',
          title: `${String(amended.length)} tasks’ acceptance rewritten after the run began`,
          evidence: evidenceOf(amended),
          times: amended.length,
          fix: 'each line run once before the stage is stacked: run extend <run> <stage.json> --dry-run --lines',
          subject: 'lines-amended'
        }
      ];
};
