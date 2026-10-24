import { commandName } from '../runMetrics';
import { isVerdict } from '../taskReports';
import { clock, evidenceOf } from './types';

import type { Finding } from './types';
import type { UsageLine } from '../usage';

/**
 * Commands that failed, grouped by why (`UsageLine.error`) — a failure that is a check's verdict on the work left out:
 * a command refused as it was written (an option the CLI has not, a command it does not know: a doc or a prompt says
 * it — encore's `task complete --follow`, three agents, four times), the machine's (a port, a permission, a browser
 * not installed), and the same error of the CLI met again and again.
 */

const AS_WRITTEN =
  /unknown option|unknown command|too many arguments|missing required argument|argument missing|There is no plitzi|invalid choice/i;

const MACHINE =
  /ECONNREFUSED|EADDRINUSE|EACCES|EPERM|ENOSPC|EMFILE|permission denied|Chromium is not installed|Executable doesn't exist|EBADENGINE/i;

/** The same error this many times is a pattern, not bad luck. */
const AGAIN = 2;

/** An error with what changes between two of its kind left out: quoted names, paths, numbers. */
const shapeOf = (error: string): string =>
  error
    .replace(/(['"`“])[^'"`”]*(['"`”])/g, '$1…$2')
    .replace(/(\/[\w.@-]+)+/g, '<path>')
    .replace(/\d+/g, 'N')
    .slice(0, 160);

const grouped = (lines: readonly UsageLine[]): UsageLine[][] => {
  const groups = new Map<string, UsageLine[]>();
  for (const line of lines) {
    const shape = shapeOf(line.error ?? '');
    groups.set(shape, [...(groups.get(shape) ?? []), line]);
  }

  return [...groups.values()].sort((a, b) => b.length - a.length);
};

/** A failed command as evidence: when, who, the command, and the first line it said of what failed past its reason. */
const said = (line: UsageLine): string => {
  const more = (line.output ?? []).find(each => each !== line.error);

  return `${clock(line.at)} ${line.by}: ${line.command.slice(0, 100)}${more ? ` — ${more.trim().slice(0, 160)}` : ''}`;
};

export const errorFindings = (usage: readonly UsageLine[]): Finding[] => {
  const failed = usage.filter(line => line.code !== 0 && line.error !== undefined);
  const asWritten = failed.filter(line => AS_WRITTEN.test(line.error ?? ''));
  const machine = failed.filter(line => MACHINE.test(line.error ?? '') && !asWritten.includes(line));
  const rest = failed.filter(line => !asWritten.includes(line) && !machine.includes(line) && !isVerdict(line.command));

  return [
    ...grouped(asWritten).map(lines => ({
      kind: 'refused-as-written' as const,
      owner: 'plitzi' as const,
      area: 'docs' as const,
      title: `Refused as written ×${String(lines.length)}: ${lines[0].error ?? ''}`,
      evidence: evidenceOf(lines.map(said)),
      times: lines.length,
      fix: 'whatever told them to write it — a prompt, a skill, a refusal’s next step — says the command the CLI has',
      subject: `as-written:${shapeOf(lines[0].error ?? '')}`,
      ...(lines.length >= AGAIN ? { live: true as const } : {})
    })),
    ...grouped(machine).map(lines => ({
      kind: 'machine-error' as const,
      owner: 'machine' as const,
      title: `${lines[0].error ?? ''}${lines.length > 1 ? ` ×${String(lines.length)}` : ''}`,
      evidence: evidenceOf(lines.map(said)),
      times: lines.length,
      subject: `machine:${shapeOf(lines[0].error ?? '')}`
    })),
    ...grouped(rest)
      .filter(lines => lines.length >= AGAIN)
      .map(lines => ({
        kind: 'command-errors' as const,
        owner: 'plitzi' as const,
        area: 'cli' as const,
        title: `${commandName(lines[0].command)} failed ×${String(lines.length)}: ${lines[0].error ?? ''}`,
        evidence: evidenceOf(lines.map(said)),
        times: lines.length,
        fix: 'said once, it should not need saying again: the error names its way out, or the command does it',
        subject: `errors:${shapeOf(lines[0].error ?? '')}`
      }))
  ];
};
