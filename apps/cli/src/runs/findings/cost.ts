import { commandName, tokensText } from '../runMetrics';
import { clock, evidenceOf } from './types';

import type { Finding } from './types';
import type { RepeatedCall } from '../runMetrics';
import type { TaskRoundReport } from '../taskReports';
import type { UsageLine } from '../usage';

/**
 * What the run spent that it did not have to: a command's answer too long to read (lx-product: a 17k-character
 * `page measure`, read again on every later turn), a call made again and again, a task that read several times what
 * the others did, a context carried whole into a task's last turn, and the results its agents read again the most.
 */

/** An answer this long is one an agent pays for on every turn after it. */
const LARGE_OUTPUT = 12_000;

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
    const name = commandName(line.command);
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
      fix: 'what an agent acts on first and short, the rest asked for (--full, --json, a narrower target)',
      subject: `large-output:${name}`
    });
  }

  for (const call of repeated) {
    findings.push({
      kind: 'repeated-call',
      owner: 'plitzi',
      area: 'cli',
      title: `${call.by} ran ${commandName(call.command)} ${String(call.times)} times in ${String(call.within)} min`,
      evidence: [call.command.slice(0, 160)],
      times: call.times,
      fix: 'what it answered did not settle it: the answer says what changed, or what to do instead',
      subject: `repeated:${call.by}:${call.command}`
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

  const typical = median([...byTask.values()].map(each => each.processed));
  if (byTask.size >= MEDIAN_OF && typical > 0) {
    for (const [task, spent] of byTask) {
      if (spent.processed > typical * COSTLY) {
        findings.push({
          kind: 'costly-task',
          owner: 'agent',
          title: `${task} read ${tokensText(spent.processed)} tokens, ${String(Math.round((spent.processed / typical) * 10) / 10)}× the run’s median task`,
          evidence: [
            `${String(spent.turns)} turns by ${[...spent.agents].join(', ')}`,
            `the median task read ${tokensText(typical)}`
          ],
          times: 1,
          fix: 'its heaviest results (in its task reports) say where: a long answer read early, a file read whole, a check run again',
          subject: `costly-task:${task}`
        });
      }
    }
  }

  for (const report of taskReports) {
    if (report.harness && report.harness.contextAtEnd >= HEAVY_CONTEXT) {
      findings.push({
        kind: 'context-heavy',
        owner: 'lead',
        title: `${report.agent} ended ${report.task} (round ${String(report.round)}) with ${tokensText(report.harness.contextAtEnd)} tokens of context`,
        evidence: [`${String(report.harness.turns)} turns; read ${tokensText(report.harness.processed)} in all`],
        times: 1,
        fix: 'a fresh session sooner — "session": "task", or a lower options.freshContextAt, in .plitzi/team.json — or a shorter brief: every turn reads the whole context again',
        subject: `context:${report.task}:${String(report.round)}`
      });
    }
  }

  const results = new Map<string, { what: string; reread: number; chars: number; results: number }>();
  for (const result of taskReports.flatMap(report => report.harness?.heaviest ?? [])) {
    const key = `${result.tool} ${result.what}`;
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
