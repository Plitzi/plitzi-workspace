import { tokensText } from '../runMetrics';
import { clock, evidenceOf } from './types';
import { kindOf } from '../harness';

import type { Finding } from './types';
import type { RepeatedCall } from '../runMetrics';
import type { TaskRoundReport } from '../taskReports';
import type { UsageLine } from '../usage';

/**
 * What the run spent that it did not have to: a command's answer too long to read (a 17k-character
 * `page measure`, read again on every later turn), a call made again and again, a task that read several times what
 * the others did, a context carried whole into a task's last turn, and the results its agents read again the most.
 */

/** An answer this long is one an agent pays for on every turn after it. */
export const LARGE_OUTPUT = 12_000;

/** A task that read this many times the run's median is one to look at. */
const COSTLY = 2.5;

/** The median is read from this many tasks at least. */
const MEDIAN_OF = 4;

/** A context this large at a task's end: a session carried across tasks, or a brief read whole again. */
const HEAVY_CONTEXT = 150_000;

/** A kind of result read again for this many tokens over the run. */
const COSTLY_RESULT = 1_000_000;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
};

export const costFindings = (
  usage: readonly UsageLine[],
  repeated: readonly RepeatedCall[],
  taskReports: readonly TaskRoundReport[]
): Finding[] => {
  const findings: Finding[] = [];
  const large = new Map<string, UsageLine[]>();
  for (const line of usage.filter(each => each.chars >= LARGE_OUTPUT)) {
    const { name } = line;
    large.set(name, [...(large.get(name) ?? []), line]);
  }

  for (const [name, lines] of large) {
    const sorted = [...lines].sort((a, b) => b.chars - a.chars);
    findings.push({
      kind: 'large-output',
      owner: 'plitzi',
      area: 'cli',
      title: `${name} answered with ${String(Math.round(sorted[0].chars / 1000))}k characters${lines.length > 1 ? ` (×${String(lines.length)} over ${String(LARGE_OUTPUT / 1000)}k)` : ''}`,
      evidence: evidenceOf(
        sorted.map(line => `${clock(line.at)} ${line.by}: ${String(line.chars)} chars — ${line.command.slice(0, 90)}`)
      ),
      times: lines.length,
      fix: 'what an agent acts on first and short, the rest asked for with an option of the same command, or a narrower target',
      subject: `large-output:${name}`
    });
  }

  // One finding a command, its bursts the evidence: a run said "lead ran task show 4 times in 8.9 min" as nine findings.
  const bursts = new Map<string, RepeatedCall[]>();
  for (const call of repeated) {
    const { name } = call;
    bursts.set(name, [...(bursts.get(name) ?? []), call]);
  }

  for (const [name, calls] of bursts) {
    const sorted = [...calls].sort((a, b) => b.times - a.times);
    const by = [...new Set(sorted.map(call => call.by))];
    findings.push({
      kind: 'repeated-call',
      owner: 'plitzi',
      area: 'cli',
      title:
        sorted.length === 1
          ? `${sorted[0].by} ran ${name} ${String(sorted[0].times)} times in ${String(sorted[0].within)} min`
          : `${name} was run again and again: ${String(sorted.length)} bursts by ${by.join(', ')}, up to ${String(sorted[0].times)} times in ${String(sorted[0].within)} min`,
      evidence: evidenceOf(
        sorted.map(
          call =>
            `${call.by}: ${String(call.times)} times in ${String(call.within)} min — ${call.command.slice(0, 120)}`
        )
      ),
      times: sorted.reduce((sum, call) => sum + call.times, 0),
      fix: 'what it answered did not settle it: the answer says what changed, or what to do instead',
      subject: `repeated:${name}`
    });
  }

  // A task's cost is every round of it.
  const byTask = new Map<string, { processed: number; turns: number; agents: Set<string> }>();
  for (const report of taskReports) {
    if (report.harness) {
      const kept = byTask.get(report.task) ?? { processed: 0, turns: 0, agents: new Set<string>() };
      kept.processed += report.harness.processed;
      kept.turns += report.harness.turns;
      kept.agents.add(report.agent);
      byTask.set(report.task, kept);
    }
  }

  // One finding each, the tasks and rounds its evidence: a run said eleven heavy contexts as eleven findings.
  const typical = median([...byTask.values()].map(each => each.processed));
  const costly =
    byTask.size >= MEDIAN_OF && typical > 0
      ? [...byTask].filter(([, spent]) => spent.processed > typical * COSTLY)
      : [];
  if (costly.length > 0) {
    const sorted = costly.sort((a, b) => b[1].processed - a[1].processed);
    findings.push({
      kind: 'costly-task',
      owner: 'agent',
      title: `${sorted.length === 1 ? `${sorted[0][0]} read` : `${String(sorted.length)} tasks read`} over ${String(COSTLY)}× the run’s median task (${tokensText(typical)})`,
      evidence: evidenceOf(
        sorted.map(
          ([task, spent]) =>
            `${task}: ${tokensText(spent.processed)}, ${String(Math.round((spent.processed / typical) * 10) / 10)}× — ${String(spent.turns)} turns by ${[...spent.agents].join(', ')}`
        )
      ),
      times: sorted.length,
      fix: 'its heaviest results (in its task reports) say where: a long answer read early, a file read whole, a check run again',
      subject: 'costly-task'
    });
  }

  const heavy = taskReports
    .filter(report => report.harness && report.harness.contextAtEnd >= HEAVY_CONTEXT)
    .sort((a, b) => (b.harness?.contextAtEnd ?? 0) - (a.harness?.contextAtEnd ?? 0));
  if (heavy.length > 0) {
    findings.push({
      kind: 'context-heavy',
      owner: 'lead',
      title: `${String(heavy.length)} round${heavy.length === 1 ? '' : 's'} ended with over ${tokensText(HEAVY_CONTEXT)} tokens of context`,
      evidence: evidenceOf(
        heavy.map(
          report =>
            `${report.agent} at ${report.task} (round ${String(report.round)}): ${tokensText(report.harness?.contextAtEnd ?? 0)}, ${String(report.harness?.turns ?? 0)} turns, ${tokensText(report.harness?.processed ?? 0)} read`
        )
      ),
      times: heavy.length,
      // A session already fresh each task (a run's team) grows within the task: the card is what is too large.
      fix: 'a smaller task — split the card so one fits a context — and results read in part; a team whose "session" is "context" or "keep" starts fresh sooner with a lower options.freshContextAt in .plitzi/team.json',
      subject: 'context-heavy'
    });
  }

  const results = new Map<string, { what: string; reread: number; chars: number; results: number }>();
  for (const result of taskReports.flatMap(report => report.harness?.heaviest ?? [])) {
    const key = kindOf(result.tool, result.what);
    const kept = results.get(key) ?? { what: key, reread: 0, chars: 0, results: 0 };
    kept.reread += result.reread;
    kept.chars += result.chars;
    kept.results += result.results;
    results.set(key, kept);
  }

  for (const result of [...results.values()]
    .filter(each => each.reread >= COSTLY_RESULT)
    .sort((a, b) => b.reread - a.reread)) {
    const ofPlitzi = result.what.includes('plitzi');
    findings.push({
      kind: 'costly-result',
      owner: ofPlitzi ? 'plitzi' : 'agent',
      ...(ofPlitzi ? { area: 'cli' as const } : {}),
      title: `What ${result.what} answered was read again for ${tokensText(result.reread)} tokens`,
      evidence: [`${String(result.results)} results, ${String(Math.round(result.chars / 1000))}k characters in all`],
      times: result.results,
      fix: ofPlitzi
        ? 'a shorter answer by default: what was read again every turn after it'
        : 'read a part (an offset, a grep), not the whole, or later in the task',
      subject: `costly-result:${result.what}`
    });
  }

  return findings;
};
