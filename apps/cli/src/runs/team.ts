import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { RunRefusal } from './refusal';

import type { RunPlan } from './model';

/**
 * Who works this project's runs (RFC 0028): the project's own choice, in `.plitzi/team.json` — committed, so the team
 * shares it — that a person edits, or asks an agent to change with `plitzi run team set`. The lead, and the agents it
 * starts: each with the roles it takes, how many of it, and the model to start it with. How many agents a run has is
 * the team's size; a task whose role nobody in the team takes is refused at `run plan`; a tester in the team gives every
 * developer task its tests (`tests.ts`); a designer in the team reviews the UI of the others' tasks before the lead.
 *
 * The CLI starts no agent: the lead's harness does, and reads here what to start each with — `run plan` says it agent by
 * agent. A model is the harness's own name for it (`claude-sonnet-5-5`, `openrouter/…`): nothing is checked but that one
 * is named.
 *
 * ```json
 * { "version": 1, "lead": { "model": "claude-opus-5-5", "effort": "high" },
 *   "agents": [{ "name": "dev", "roles": ["developer"], "count": 2, "model": "claude-sonnet-5-5" },
 *              { "name": "design", "roles": ["designer", "reviewer"], "model": "claude-opus-5-5" },
 *              { "name": "test", "roles": ["tester"], "model": "claude-sonnet-5-5" }] }
 * ```
 */

export const TEAM_FILE = path.join('.plitzi', 'team.json');

/** The role of a task that says none. */
export const DEVELOPER = 'developer';
export const DESIGNER = 'designer';
export const TESTER = 'tester';

export interface Model {
  model: string;
  /** How hard it thinks, in the harness's words (`high`) — left to it when not said. */
  effort?: string;
}

export interface TeamAgent {
  /** What its agents are called: `dev` is `dev-1`, `dev-2`… — the `--agent` each takes its tasks with. */
  name: string;
  roles: string[];
  /** How many agents of it; one when not said. */
  count?: number;
  model?: string;
  effort?: string;
}

export interface Team {
  version: 1;
  lead?: Model;
  agents: TeamAgent[];
}

/** One agent of the team, as it is started: its own name, its roles, its model. */
export interface StartedAgent {
  agent: string;
  roles: string[];
  model?: Model;
}

/** A role's or an agent's name, as a plan writes one. */
const NAME = /^[a-z][a-z0-9_-]{0,63}$/;
const MAX_COUNT = 16;

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(each => typeof each === 'string');

const isModel = (value: unknown): value is Model =>
  isRecord(value) &&
  typeof value.model === 'string' &&
  value.model.trim() !== '' &&
  (value.effort === undefined || typeof value.effort === 'string');

/** What is wrong with one agent of the file, said — none when it is one. */
const agentProblem = (value: unknown): string | undefined => {
  if (!isRecord(value) || typeof value.name !== 'string' || !NAME.test(value.name)) {
    return 'an agent is { "name": "dev", "roles": ["developer"], "count"?: 2, "model"?: "…", "effort"?: "…" }';
  }

  const { name } = value;
  if (name === 'lead') {
    return '"lead" is the lead’s: give the lead its model under "lead", and the agent another name';
  }

  if (!isStrings(value.roles) || value.roles.length === 0 || !value.roles.every(role => NAME.test(role))) {
    return `"${name}": its roles are names — ["developer"], ["designer", "reviewer"], ["tester"]`;
  }

  if (
    value.count !== undefined &&
    (typeof value.count !== 'number' || !Number.isInteger(value.count) || value.count < 1 || value.count > MAX_COUNT)
  ) {
    return `"${name}": its count is a whole number from 1 to ${String(MAX_COUNT)}`;
  }

  if (value.model !== undefined && (typeof value.model !== 'string' || value.model.trim() === '')) {
    return `"${name}": its model is the harness’s name for one — claude-sonnet-5-5`;
  }

  if (value.effort !== undefined && typeof value.effort !== 'string') {
    return `"${name}": its effort is the harness’s word for it — high`;
  }

  return undefined;
};

const isTeamAgent = (value: unknown): value is TeamAgent => agentProblem(value) === undefined;

/** The project's team, or none when it has not said one — refused, saying what is wrong, when the file is not one. */
export const readTeam = async (root: string): Promise<Team | undefined> => {
  const text = await fs.readFile(path.join(root, TEAM_FILE), 'utf-8').catch(() => undefined);
  if (text === undefined) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RunRefusal('invalid', `${TEAM_FILE} is not JSON: fix it, or remove it to have no team`);
  }

  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.agents)) {
    throw new RunRefusal('invalid', `${TEAM_FILE} is not { "version": 1, "lead"?: { "model": "…" }, "agents": [ … ] }`);
  }

  if (parsed.lead !== undefined && !isModel(parsed.lead)) {
    throw new RunRefusal('invalid', `${TEAM_FILE}: "lead" is { "model": "…", "effort"?: "…" }`);
  }

  const problems = parsed.agents.flatMap(each => agentProblem(each) ?? []);
  const names = parsed.agents.filter(isTeamAgent).map(agent => agent.name);
  const repeated = names.filter((name, index) => names.indexOf(name) !== index);
  if (repeated.length > 0) {
    problems.push(`${[...new Set(repeated)].map(name => `"${name}"`).join(', ')} is in the team twice`);
  }

  if (problems.length > 0) {
    throw new RunRefusal('invalid', `${TEAM_FILE}:\n${problems.map(each => `  - ${each}`).join('\n')}`, { problems });
  }

  return {
    version: 1,
    ...(isModel(parsed.lead) ? { lead: parsed.lead } : {}),
    agents: parsed.agents.filter(isTeamAgent)
  };
};

export const TEAM_EXAMPLE_FILE = path.join('.plitzi', 'team.json.example');

/** A team as a project might write it: a strong lead and designer, cheaper developers and tester. */
export const TEAM_EXAMPLE: Team = {
  version: 1,
  lead: { model: 'claude-opus-5-5', effort: 'high' },
  agents: [
    { name: 'dev', roles: [DEVELOPER], count: 2, model: 'claude-sonnet-5-5' },
    { name: 'design', roles: [DESIGNER, 'reviewer'], model: 'claude-opus-5-5' },
    { name: 'test', roles: [TESTER], model: 'claude-sonnet-5-5' }
  ]
};

/** The team a plan needs at least: two developers when it has developer tasks, and one agent for each other role. */
const starterTeam = (plan: Pick<RunPlan, 'tasks'>): Team => {
  const roles = [...new Set(plan.tasks.map(task => task.role ?? DEVELOPER))];

  return {
    version: 1,
    agents: [
      ...(roles.includes(DEVELOPER) ? [{ name: 'dev', roles: [DEVELOPER], count: 2 }] : []),
      ...roles.filter(role => role !== DEVELOPER).map(role => ({ name: role, roles: [role] }))
    ]
  };
};

/**
 * The project's team, which every run is worked by: its size is how many agents work at once, its roles what a plan's
 * tasks may be. The first run of a project that has none writes one — the least the plan needs, the harness's own
 * models — and an example beside it, said with how to change it; one with no agents is refused, as somebody emptied it.
 */
export const ensureTeam = async (
  root: string,
  plan: Pick<RunPlan, 'tasks'>
): Promise<{ team: Team; created?: string }> => {
  const found = await readTeam(root);
  if (found) {
    if (found.agents.length === 0) {
      throw new RunRefusal(
        'invalid',
        `The team (${TEAM_FILE}) has no agents: a run is worked by it. Add one: plitzi run team set dev --roles developer --count 2 [--model <model>]`
      );
    }

    return { team: found };
  }

  const team = starterTeam(plan);
  await writeTeam(root, team);
  if (!(await fs.stat(path.join(root, TEAM_EXAMPLE_FILE)).catch(() => undefined))) {
    await fs.writeFile(path.join(root, TEAM_EXAMPLE_FILE), `${JSON.stringify(TEAM_EXAMPLE, null, 2)}\n`);
  }

  return {
    team,
    created: `This project had no team: ${TEAM_FILE} written with what the plan needs — ${team.agents.map(teamAgentText).join('; ')} — each the harness's own model. Change it with plitzi run team set <name> --roles … --count … --model … (a lead model, a designer who reviews the UI, a tester who writes the tests: ${TEAM_EXAMPLE_FILE})`
  };
};

/** Each agent of the team as it is started — `dev-1`, `dev-2`… — in the file's order. */
export const startedAgents = (team: Team): StartedAgent[] =>
  team.agents.flatMap(each =>
    Array.from({ length: each.count ?? 1 }, (_, index) => ({
      agent: `${each.name}-${String(index + 1)}`,
      roles: each.roles,
      ...(each.model ? { model: { model: each.model, ...(each.effort ? { effort: each.effort } : {}) } } : {})
    }))
  );

/** How many agents the team has: how many may work a run at once. */
export const teamSize = (team: Team): number => team.agents.reduce((sum, each) => sum + (each.count ?? 1), 0);

/** The agents held to a role, for a rehearsal: those that take one role alone — one of several takes any of them. */
export const heldRoles = (team: Team): Record<string, number> => {
  const held: Record<string, number> = {};
  for (const each of team.agents.filter(agent => agent.roles.length === 1)) {
    const [role] = each.roles;
    held[role] = (Object.hasOwn(held, role) ? held[role] : 0) + (each.count ?? 1);
  }

  return held;
};

/** Whether someone in the team takes the role. */
export const teamTakes = (team: Team, role: string): boolean => team.agents.some(each => each.roles.includes(role));

/** Whether the run reviews design: as the plan says — or, when it does not, whether the team has a designer. */
export const reviewsDesign = (team: Team | undefined, plan: Pick<RunPlan, 'designReview'>): boolean =>
  plan.designReview ?? (team ? teamTakes(team, DESIGNER) : false);

/** The tasks of the plan whose role nobody in the team takes, said with the fix. */
export const roleProblems = (plan: Pick<RunPlan, 'tasks'>, team: Team): string[] =>
  plan.tasks
    .filter(task => !teamTakes(team, task.role ?? DEVELOPER))
    .map(
      task =>
        `Task "${task.id}" is a ${task.role ?? DEVELOPER}'s, and nobody in the team (${TEAM_FILE}) takes ${task.role ?? DEVELOPER}: give it a role the team has, or add one (plitzi run team set <name> --roles ${task.role ?? DEVELOPER})`
    );

export const modelText = (model: Model): string => `${model.model}${model.effort ? ` (${model.effort})` : ''}`;

/** One agent of the team, as `run team` says it. */
export const teamAgentText = (each: TeamAgent): string =>
  `${each.name}${(each.count ?? 1) > 1 ? ` × ${String(each.count)}` : ''} — ${each.roles.join(', ')}${each.model ? ` — ${modelText({ model: each.model, ...(each.effort ? { effort: each.effort } : {}) })}` : ''}`;

export interface TeamChange {
  name: string;
  before?: TeamAgent | Model;
  after?: TeamAgent | Model;
  file: string;
}

/** What `run team set` is given: whatever of the agent it changes — the rest is kept as it was. */
export interface TeamAgentChange {
  roles?: string[];
  count?: number;
  model?: string;
  effort?: string;
}

const writeTeam = async (root: string, team: Team): Promise<void> => {
  await fs.mkdir(path.join(root, path.dirname(TEAM_FILE)), { recursive: true });
  await fs.writeFile(path.join(root, TEAM_FILE), `${JSON.stringify(team, null, 2)}\n`);
};

/**
 * `plitzi run team set <name>`: one agent of the team made or changed — `lead` the lead's model — and what it was before
 * said with what it is now. A new agent needs its roles; nothing else of the file is touched.
 */
export const setTeamAgent = async (root: string, name: string, change: TeamAgentChange): Promise<TeamChange> => {
  const team = (await readTeam(root)) ?? { version: 1, agents: [] };
  if (name === 'lead') {
    if (change.roles !== undefined || change.count !== undefined) {
      throw new RunRefusal(
        'invalid',
        'The lead is one, and leads: give it a --model (and --effort), no roles or count'
      );
    }

    if (change.model === undefined) {
      throw new RunRefusal('invalid', 'The lead’s model is named: plitzi run team set lead --model claude-opus-5-5');
    }

    const lead: Model = { model: change.model, ...(change.effort ? { effort: change.effort } : {}) };
    await writeTeam(root, { ...team, lead });

    return { name, ...(team.lead ? { before: team.lead } : {}), after: lead, file: TEAM_FILE };
  }

  const before = team.agents.find(each => each.name === name);
  const roles = change.roles ?? before?.roles;
  if (roles === undefined) {
    throw new RunRefusal(
      'invalid',
      `"${name}" is not in the team yet: say what it takes — plitzi run team set ${name} --roles developer`
    );
  }

  const after: TeamAgent = {
    name,
    roles,
    ...((change.count ?? before?.count) !== undefined ? { count: change.count ?? before?.count } : {}),
    ...((change.model ?? before?.model) !== undefined ? { model: change.model ?? before?.model } : {}),
    ...((change.effort ?? before?.effort) !== undefined ? { effort: change.effort ?? before?.effort } : {})
  };
  const problem = agentProblem(after);
  if (problem !== undefined) {
    throw new RunRefusal('invalid', `${TEAM_FILE}: ${problem}`);
  }

  if (before && JSON.stringify(before) === JSON.stringify(after)) {
    throw new RunRefusal('invalid', `"${name}" is already ${teamAgentText(after)}: nothing to change`);
  }

  await writeTeam(root, {
    ...team,
    agents: before ? team.agents.map(each => (each.name === name ? after : each)) : [...team.agents, after]
  });

  return { name, ...(before ? { before } : {}), after, file: TEAM_FILE };
};

/** `plitzi run team unset <name>`: one agent out of the team — or the lead's model, for `lead`. */
export const unsetTeamAgent = async (root: string, name: string): Promise<TeamChange> => {
  const team = await readTeam(root);
  if (name === 'lead') {
    if (!team?.lead) {
      throw new RunRefusal('invalid', `The lead has no model of its own to take out (${TEAM_FILE})`);
    }

    const { lead, ...rest } = team;
    await writeTeam(root, rest);

    return { name, before: lead, file: TEAM_FILE };
  }

  const before = team?.agents.find(each => each.name === name);
  if (!team || !before) {
    throw new RunRefusal(
      'invalid',
      `"${name}" is not in the team (${TEAM_FILE})${team ? `: it has ${team.agents.map(each => each.name).join(', ') || 'nobody'}` : ''}`
    );
  }

  await writeTeam(root, { ...team, agents: team.agents.filter(each => each.name !== name) });

  return { name, before, file: TEAM_FILE };
};
