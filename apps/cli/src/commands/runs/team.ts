import { act } from './shell';
import { RunRefusal } from '../../runs/refusal';
import {
  checkTeamFile,
  EFFORTS,
  isEffort,
  parseModelChoice,
  coLeadNames,
  leadText,
  ROLES,
  readTeam,
  setTeamAgent,
  TEAM_FILE,
  teamAgentText,
  teamSize,
  unsetTeamAgent
} from '../../runs/team';

import type { RunCommandOptions } from './shell';
import type { Effort, TeamChange } from '../../runs/team';

/**
 * `plitzi run team`: who works this project's runs, shown and changed.
 */

export const runTeam = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => ({ file: TEAM_FILE, team: (await readTeam(ctx.root)) ?? null }),
    shown =>
      shown.team === null
        ? [
            `No team (${shown.file}): a project's first run writes the one its plan needs. Make it now: plitzi run team set dev --roles developer --count 2 [--model <model>]`,
            ...rolesText()
          ].join('\n')
        : [
            `This project's team (${shown.file}), ${String(teamSize(shown.team))} agents and ${String(coLeadNames(shown.team).length + 1)} lead(s):`,
            `  lead — ${leadText(shown.team.lead)}: plans, answers, decides, finishes${coLeadNames(shown.team).length > 0 ? ` — and ${coLeadNames(shown.team).join(', ')} review beside it` : ''}`,
            ...shown.team.agents.map(each => `  ${teamAgentText(each)}`),
            ...rolesText()
          ].join('\n')
  );

/** The roles the CLI knows, a line each — and that any other name is one of the project's own. */
const rolesText = (): string[] => [
  'Roles:',
  ...Object.entries(ROLES).map(([role, does]) => `  ${role} — ${does}`),
  '  any other name — a role of your own: a task names it, an agent takes it'
];

const memberText = (member: TeamChange['before']): string =>
  member === undefined ? 'none' : 'name' in member ? teamAgentText(member) : leadText(member);

export interface TeamSetOptions extends RunCommandOptions {
  roles?: string[];
  count?: number;
  min?: number;
  model?: string;
  effort?: string;
  sessionPerTask?: boolean;
  resumeSession?: boolean;
}

/** `--effort`, refused naming the words when it is none of them. */
const effortOf = (text: string): Effort => {
  if (!isEffort(text)) {
    throw new RunRefusal('invalid', `--effort ${text}: one of ${EFFORTS.join(', ')}`);
  }

  return text;
};

export const runTeamSet = (name: string, options: TeamSetOptions): Promise<void> =>
  act(
    options,
    async ctx =>
      setTeamAgent(ctx.root, name, {
        ...(options.roles ? { roles: options.roles } : {}),
        ...(options.count !== undefined ? { count: options.count } : {}),
        ...(options.min !== undefined ? { min: options.min } : {}),
        ...(options.model ? { model: parseModelChoice(options.model) } : {}),
        ...(options.effort ? { effort: effortOf(options.effort) } : {}),
        ...(options.sessionPerTask !== undefined ? { sessionPerTask: options.sessionPerTask } : {}),
        ...(options.resumeSession !== undefined ? { resumeSession: options.resumeSession } : {})
      }),
    changed =>
      changed.unchanged
        ? `${changed.name} is already ${memberText(changed.after)}: nothing to change (${changed.file})`
        : `${changed.name}: ${memberText(changed.before)} → ${memberText(changed.after)} (${changed.file})`
  );

export const runTeamCheck = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => ({ file: TEAM_FILE, problems: (await checkTeamFile(ctx.root)) ?? null }),
    checked =>
      checked.problems === null
        ? `No team (${checked.file}): a project's first run writes the one its plan needs.`
        : checked.problems.length === 0
          ? `${checked.file} is a team the runs read as written.`
          : [`${checked.file} would be refused:`, ...checked.problems.map(problem => `  - ${problem}`)].join('\n'),
    checked => (checked.problems !== null && checked.problems.length > 0 ? 20 : 0)
  );

export const runTeamUnset = (name: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => unsetTeamAgent(ctx.root, name),
    changed => `${changed.name}: ${memberText(changed.before)} → out of the team (${changed.file})`
  );
