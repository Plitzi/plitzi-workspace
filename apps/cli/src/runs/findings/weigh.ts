import type { Finding } from './types';
import type { UsageLine } from '../core/usage';

/**
 * How much a finding weighs, in figures read off the run: how often it was met, in how many runs, and how much of the
 * run the command it is about carries — its calls, the agents calling it, the calls that failed. A run's findings read
 * the same whether met once by one agent on a command run twice, or by every agent on the one they run the most; the
 * person asked for the figures to decide by, and a weight that orders them.
 */

/** The command a finding is about, and what the run made of it. */
export interface FindingReach {
  command: string;
  calls: number;
  agents: number;
  failed: number;
}

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The command a finding names — its title first, then its evidence — among those the run ran: the one named first, the
 * longest where two start at one place (`page check` before `page`) — "page shot has no --element … page measure takes
 * the same names" is page shot's.
 */
export const commandNamed = (
  finding: Pick<Finding, 'title' | 'evidence'>,
  names: readonly string[]
): string | undefined => {
  for (const said of [finding.title, ...finding.evidence]) {
    const found = names
      .filter(Boolean)
      .flatMap(name => {
        const at = new RegExp(`(?<![\\w-])${escaped(name)}(?![\\w-])`).exec(said)?.index;

        return at === undefined ? [] : [{ name, at }];
      })
      .sort((a, b) => a.at - b.at || b.name.length - a.name.length)
      .at(0);
    if (found !== undefined) {
      return found.name;
    }
  }

  return undefined;
};

/** Each finding with the reach of the command it names, where it names one the run ran. */
export const withReach = (findings: readonly Finding[], usage: readonly UsageLine[]): Finding[] => {
  const byName = new Map<string, UsageLine[]>();
  for (const line of usage) {
    if (line.name !== '') {
      byName.set(line.name, [...(byName.get(line.name) ?? []), line]);
    }
  }

  const names = [...byName.keys()];

  return findings.map(finding => {
    const command = commandNamed(finding, names);
    const lines = command === undefined ? [] : (byName.get(command) ?? []);

    return command === undefined
      ? finding
      : {
          ...finding,
          reach: {
            command,
            calls: lines.length,
            agents: new Set(lines.map(line => line.by)).size,
            failed: lines.filter(line => line.code !== 0).length
          }
        };
  });
};

/**
 * A finding's weight: the times it was met, by the runs it was met in (this one and those before), by the agents that
 * run the command it is about — what fixing it would spare the most, first.
 */
export const weightOf = (finding: Pick<Finding, 'times' | 'seenIn' | 'reach'>): number =>
  finding.times * (1 + (finding.seenIn?.length ?? 0)) * Math.max(1, finding.reach?.agents ?? 1);

/** The figures a finding is said with: its weight, the runs, and its command's reach. */
export const weighedText = (finding: Pick<Finding, 'times' | 'seenIn' | 'reach'>): string => {
  const runs = 1 + (finding.seenIn?.length ?? 0);
  const { reach } = finding;

  return [
    `weight ${String(weightOf(finding))}`,
    `${String(runs)} run${runs === 1 ? '' : 's'}`,
    ...(reach === undefined
      ? []
      : [
          `${reach.command}: ${String(reach.calls)} call${reach.calls === 1 ? '' : 's'} by ${String(reach.agents)} agent${reach.agents === 1 ? '' : 's'}${reach.failed > 0 ? `, ${String(reach.failed)} failed` : ''}`
        ])
  ].join(' · ');
};
