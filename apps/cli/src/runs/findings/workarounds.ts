import { ownScriptLines } from '../ownScripts';
import { evidenceOf } from './types';
import { groupAlike } from './words';

import type { Finding, SaidOfPlitzi } from './types';
import type { RunTask } from '../model';

/**
 * What the run did beside Plitzi — each one a command or a feature it lacked: acceptance checked by scripts of the
 * lead's own (encore: the sign-up, the share card, the player's sync, an action called over HTTP), scripts the agents
 * wrote in their scratch, packages they installed there (design-1's axe-core, for an accessibility audit) — and what
 * they said of Plitzi, grouped: three agents noticed the prompt's `task complete --follow` four times.
 */

export const workaroundFindings = (
  tasks: readonly RunTask[],
  scratch: readonly { agent: string; scripts: string[]; packages: string[] }[]
): Finding[] => {
  const findings: Finding[] = [];
  const own = ownScriptLines(tasks);
  if (own.length > 0) {
    findings.push({
      kind: 'own-script',
      owner: 'plitzi',
      area: 'cli',
      title: `${String(own.length)} acceptance line(s) checked by scripts of the lead’s own`,
      evidence: evidenceOf(own.map(each => `${each.task}: “${each.line}” — ${each.scripts.join(', ')}`)),
      times: own.length,
      fix: 'what each script checks, as a page command any agent reruns',
      subject: 'own-script'
    });
  }

  const scripts = scratch.filter(each => each.scripts.length > 0);
  if (scripts.length > 0) {
    findings.push({
      kind: 'scratch-script',
      owner: 'plitzi',
      area: 'cli',
      title: `Scripts written beside the CLI: ${String(scripts.reduce((sum, each) => sum + each.scripts.length, 0))}`,
      evidence: evidenceOf(scripts.map(each => `${each.agent}: ${each.scripts.join(', ')}`)),
      times: scripts.reduce((sum, each) => sum + each.scripts.length, 0),
      fix: 'what each does that no command did — read them before the run’s scratch goes',
      subject: 'scratch-script'
    });
  }

  const packages = scratch.filter(each => each.packages.length > 0);
  if (packages.length > 0) {
    findings.push({
      kind: 'scratch-package',
      owner: 'plitzi',
      area: 'cli',
      title: 'Packages installed to do what the CLI did not',
      evidence: evidenceOf(packages.map(each => `${each.agent}: ${each.packages.join(', ')}`)),
      times: packages.reduce((sum, each) => sum + each.packages.length, 0),
      fix: 'what they were installed for, as a check of the CLI’s own',
      subject: 'scratch-package'
    });
  }

  return findings;
};

/**
 * What was said of Plitzi — notices and frictions together — one finding a thing said, live when two or more said it:
 * the same complaint from three agents is one thing to fix.
 */
export const saidFindings = (said: readonly SaidOfPlitzi[]): Finding[] =>
  groupAlike(said, notice => notice.text).map(group => {
    const agents = [...new Set(group.map(notice => notice.by))];
    const first = group[0];

    return {
      kind: 'said' as const,
      owner: 'plitzi' as const,
      title: first.text.length > 220 ? `${first.text.slice(0, 220)}…` : first.text,
      evidence: evidenceOf(
        group.map(
          notice =>
            `${notice.by}${notice.task ? ` at ${notice.task}` : ''}${notice.on ? `, on ${notice.on}` : ''}${notice.as === 'friction' ? ' (what got in its way)' : ''}${notice === first ? '' : `: ${notice.text.slice(0, 160)}`}`
        )
      ),
      times: group.length,
      subject: `notice:${first.at}`,
      ...(agents.length > 1 ? { live: true as const } : {})
    };
  });
