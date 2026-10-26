import chalk from 'chalk';

import { runOpen } from './plan';
import { launchBrowser } from '../../browser';
import { HARNESSES, isHarness } from '../../runs/agentPrompt';
import { onPath } from '../../runs/launchAgent';
import { ID } from '../../runs/paths';
import { readTeam, SCOUT, startedAgents } from '../../runs/team';
import { projectHere } from '../existingProject';
import { fail } from '../terminal';

import type { PlanOptions } from './plan';

/**
 * `plitzi run start "<the ask>"`: a team of agents on the project, from one command — what is needed checked first
 * (a space in the project's code, a browser to check pages with, the harness asked for), the run opened on its scope,
 * and every step after it said: the scope, the team started (`run agent`), following it, the person's final merge.
 * Opening a run took a plan, a team, a token and a prompt for each agent, each read about apart.
 */

export interface StartOptions extends PlanOptions {
  harness?: string;
}

/** What a run needs before it opens, each said with its fix: none, when the project is ready. */
const notReady = async (harness: string | undefined): Promise<string[] | undefined> => {
  const project = await projectHere('to start a run in');
  if (!project) {
    return undefined;
  }

  const problems: string[] = [];
  if (project.plitzi?.kind !== 'project' || project.plitzi.source !== 'local') {
    problems.push(
      'A run works a project whose space is its code (src/space/): this is none — `npx @plitzi/cli create` makes one, and `create --from <space>` brings a space on Plitzi into one'
    );
  }

  // Every task's check and look opens its pages in the project's Chromium: missing, each would fail on it.
  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    problems.push(`${browser.problem} — every task's checks open its pages in it`);
  } else {
    await browser.close();
  }

  if (harness !== undefined) {
    if (!isHarness(harness)) {
      problems.push(`--harness ${harness}: one of ${HARNESSES.join(', ')}`);
    } else if (!(await onPath(harness))) {
      problems.push(
        `--harness ${harness}: \`${harness}\` is not on this machine's PATH — install it, or start the agents yourself`
      );
    }
  }

  return problems;
};

/**
 * The run's name when it is not said: the ask's first words, as an id takes them — what `--run` says it defaults to (a
 * run's start without it was refused, the help promising otherwise). None when the ask has no word an id keeps.
 */
export const runNameOf = (ask: string): string | undefined => {
  const words = ask
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let name = '';
  for (const word of words.slice(0, 4)) {
    const next = name === '' ? word : `${name}-${word}`;
    if (next.length > 40) {
      break;
    }

    name = next;
  }

  return ID.test(name) ? name : undefined;
};

export const runStart = async (ask: string, options: StartOptions): Promise<void> => {
  const problems = await notReady(options.harness);
  if (problems === undefined) {
    return;
  }

  if (problems.length > 0) {
    fail(['Not ready for a run yet:', ...problems.map(each => `  - ${each}`)].join('\n'));

    return;
  }

  const run = options.run ?? runNameOf(ask);
  if (run === undefined) {
    fail(`Name the run: the ask has no word a name is made of — plitzi run start "${ask}" --run <name>`);

    return;
  }

  await runOpen(undefined, { ...options, spike: ask, run });
  // Refused — any exit code a refusal sets — nothing opened: what happens next is no one's.
  if ((process.exitCode !== undefined && process.exitCode !== 0) || options.json === true) {
    return;
  }

  const project = await projectHere('to start a run in');
  const team = project ? await readTeam(project.root) : undefined;
  const base = team ? startedAgents(team).filter(each => each.onDemand !== true) : [];
  const harness = options.harness ?? '<claude|codex|opencode>';
  const scouts = team ? startedAgents(team).filter(each => each.roles.includes(SCOUT)) : [];
  console.log(
    [
      '',
      chalk.bold('What happens now — a team of agents, you the person who applies its work:'),
      scouts.length > 0
        ? `  1. The scope is a scout's (${scouts.map(each => each.agent).join(', ')}): it finds out what the ask takes and proposes the tasks; the lead decides them with you and approves them — the agent you asked, or one started on the lead's own CLI, as said above.`
        : "  1. The scope is the lead's (the team has no scout): it finds out what the ask takes and ends it with the tasks — the agent you asked, or one started on the lead's own CLI, as said above.",
      // A team that says how to start its agents is started by the run's keeper: told to start it by hand, an opener
      // would start it twice.
      team?.options?.launch === undefined
        ? `  2. The team, once there are tasks: ${base.map(each => `plitzi run agent ${each.agent} --launch --harness ${harness}`).join(' · ') || 'plitzi run agent <name> --launch'} — the lead starts more on demand when run watch says so.`
        : `  2. The team starts by itself once there are tasks (team.json's options.launch, ${team.options.launch}): ${base.map(each => each.agent).join(', ') || 'its base'}, and more when work waits — start none of them.`,
      '  3. Follow it: plitzi run monitor in a terminal of yours — its p serves the approved work as it goes.',
      '  4. The end: the lead looks at the whole result (run look), writes the report and the dry finish; you read it and apply it — plitzi run finish --apply. Nothing touches the project before it; plitzi run abort leaves no trace.'
    ].join('\n')
  );
};
