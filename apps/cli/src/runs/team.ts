import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { RunRefusal } from './refusal';
import { formattedJson } from '../scaffold/formattedJson';

import type { RunPlan } from './model';

/**
 * Who works this project's runs: the project's own choice, in `.plitzi/team.json` — committed, so the team
 * shares it — that a person edits, or asks an agent to change with `plitzi run team set`. The lead, and the agents it
 * starts: each with the roles it takes, how many of it, and the model to start it with. How many agents a run has is
 * the team's size; a task whose role nobody in the team takes is refused at `run plan`; a tester in the team gives every
 * developer task its tests (`tests.ts`); a designer in the team reviews the UI of the others' tasks before the lead.
 *
 * The leads are one for every four agents (`AGENTS_PER_LEAD`), or as many as `"lead": { "count" }` says: the first, `lead`,
 * plans, answers, decides and finishes; the others (`lead-2`, `lead-3`…) review tasks as it does, taking each from one
 * queue — two levels, and no lead with agents of its own.
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

/** The leads' entry: their model, and how many — one for every `AGENTS_PER_LEAD` agents when not said. */
export interface Lead {
  model?: string;
  effort?: string;
  count?: number;
}

export interface Team {
  version: 1;
  lead?: Lead;
  agents: TeamAgent[];
  /**
   * What the file's fields and the roles mean, for the person who edits it (`TEAM_ABOUT`): JSON has no comments. The
   * CLI's: never read, written as this CLI says it whenever the file is written, and brought up by `plitzi upgrade`.
   */
  about?: Record<string, unknown>;
}

/**
 * The roles the CLI knows, and what each does in a run: a task names one (`"role"`), an agent takes some. Any other
 * name is a role of the project's own — a task names it and an agent of the team takes it, with nothing more to it.
 */
export const ROLES = {
  developer: 'Writes the code of a task: the role of a task that names none.',
  designer:
    'Designs (tasks of its own), and reviews the UI/UX of the tasks of other roles before the lead, as a designer.',
  reviewer: 'Reviews as a task of its own: an accessibility pass, a code audit — and fixes what it finds.',
  tester:
    'Writes the tests of each developer task, after it: <task>-tests, from what the task was asked, never bent to pass.',
  writer: 'Writes the words: the copy of a page, the docs, the help.'
} as const;

/** One agent of the team, as it is started: its own name, its roles, its model. */
export interface StartedAgent {
  agent: string;
  roles: string[];
  model?: Model;
}

/** A role's or an agent's name, as a plan writes one. */
const NAME = /^[a-z][a-z0-9_-]{0,63}$/;
const MAX_COUNT = 16;
const MAX_LEADS = 8;

/**
 * How many agents a lead reviews for: past it the reviews queue up behind one lead (v12: five agents, one lead, tasks
 * waiting for it) — and below it a second lead costs more than it saves.
 */
export const AGENTS_PER_LEAD = 4;

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(each => typeof each === 'string');

const isLeadEntry = (value: unknown): value is Lead =>
  isRecord(value) &&
  (value.model === undefined || (typeof value.model === 'string' && value.model.trim() !== '')) &&
  (value.effort === undefined || typeof value.effort === 'string') &&
  (value.count === undefined ||
    (typeof value.count === 'number' && Number.isInteger(value.count) && value.count >= 1 && value.count <= MAX_LEADS));

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

  if (parsed.lead !== undefined && !isLeadEntry(parsed.lead)) {
    throw new RunRefusal(
      'invalid',
      `${TEAM_FILE}: "lead" is { "model"?: "…", "effort"?: "…", "count"?: 1 to ${String(MAX_LEADS)} }`
    );
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
    ...(isLeadEntry(parsed.lead) ? { lead: parsed.lead } : {}),
    agents: parsed.agents.filter(isTeamAgent),
    ...(isRecord(parsed.about) ? { about: parsed.about } : {})
  };
};

/**
 * What the file's fields and the roles mean, kept in it for the person who edits it: JSON has no comments. Models are
 * left to the harness — the file says how to choose one, in whichever harness runs the agents.
 */
export const TEAM_ABOUT: Record<string, unknown> = {
  file: 'Who works the runs of several agents on this project (plitzi run). Edit it, or: plitzi run team set <name> --roles … --count … --model …',
  lead: 'The lead plans, reviews every task — the complete, strict review, and the final word — answers and closes: the one you talk to. Give it your strongest model: "lead": { "model": "…", "effort": "high" } (plitzi run team set lead --model …). One lead for every 4 agents: lead plans and finishes, lead-2, lead-3… only review, as strictly — "count" says another number (plitzi run team set lead --count 1).',
  agents:
    'Each agent: a name (dev is dev-1, dev-2…), the roles it takes, how many of it (count), and the model to start it with, as the harness names it (claude-sonnet-5-5 in Claude Code; any model opencode or another harness takes); left out, the default of the harness. How many agents work at once is the sum of the counts.',
  roles: { ...ROLES, '<any other>': 'A role of your own: a task names it, an agent takes it.' },
  more: 'It starts small — every agent spends tokens: one developer, and a designer who reviews the UI of every other task. Grow it when a job asks: more developers (plitzi run team set dev --count 3), a tester who writes the tests of each developer task (plitzi run team set test --roles tester), a writer.'
};

/** The team a project starts with: a developer and a designer — two agents, the harness's own models. */
export const STARTER_TEAM: Team = {
  version: 1,
  about: TEAM_ABOUT,
  agents: [
    { name: 'dev', roles: [DEVELOPER] },
    { name: 'design', roles: [DESIGNER] }
  ]
};

/** The team a plan needs at least: the starter's, and one agent for each other role it names. */
const teamFor = (plan: Pick<RunPlan, 'tasks'>): Team => {
  const roles = [...new Set(plan.tasks.map(task => task.role ?? DEVELOPER))];

  return {
    ...STARTER_TEAM,
    agents: [
      ...STARTER_TEAM.agents,
      ...roles.filter(role => !teamTakes(STARTER_TEAM, role)).map(role => ({ name: role, roles: [role] }))
    ]
  };
};

/**
 * The project's team, which every run is worked by: its size is how many agents work at once, its roles what a plan's
 * tasks may be. `plitzi create` writes the starter; a project made before it gets one at its first run — the starter
 * with an agent for each other role the plan names — said with how to change it. One with no agents is refused, as
 * somebody emptied it.
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

  const team = teamFor(plan);
  await writeTeam(root, team);

  return {
    team,
    created: `This project had no team: ${TEAM_FILE} written with what the plan needs — ${team.agents.map(teamAgentText).join('; ')} — each the harness's own model, and what each field and role means. Change it with plitzi run team set <name> --roles … --count … --model … (a lead model, a designer who reviews the UI, a tester who writes the tests)`
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

/** How many leads the team has: as `"lead": { "count" }` says, or one for every `AGENTS_PER_LEAD` agents. */
export const leadCount = (team: Team): number =>
  team.lead?.count ?? Math.max(1, Math.ceil(teamSize(team) / AGENTS_PER_LEAD));

/** The leads besides `lead`, by the names they are started with: `lead-2`, `lead-3`… — they review, nothing else. */
export const coLeadNames = (team: Team): string[] =>
  Array.from({ length: leadCount(team) - 1 }, (_, index) => `lead-${String(index + 2)}`);

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

/** The model the leads are started with, said. */
export const leadModelText = (lead: Lead | undefined): string =>
  lead?.model
    ? modelText({ model: lead.model, ...(lead.effort ? { effort: lead.effort } : {}) })
    : 'the harness’s own model';

/** The leads' entry, as `run team` says it: the model, and how many when it is said. */
export const leadText = (lead: Lead | undefined): string =>
  `${leadModelText(lead)}${lead?.count !== undefined ? ` × ${String(lead.count)}` : ''}`;

/** One agent of the team, as `run team` says it. */
export const teamAgentText = (each: TeamAgent): string =>
  `${each.name}${(each.count ?? 1) > 1 ? ` × ${String(each.count)}` : ''} — ${each.roles.join(', ')}${each.model ? ` — ${modelText({ model: each.model, ...(each.effort ? { effort: each.effort } : {}) })}` : ''}`;

export interface TeamChange {
  name: string;
  before?: TeamAgent | Lead;
  after?: TeamAgent | Lead;
  file: string;
  /** It was already so: nothing written, and said. */
  unchanged?: true;
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
  await fs.writeFile(path.join(root, TEAM_FILE), formattedJson({ ...team, about: TEAM_ABOUT }));
};

/**
 * `plitzi upgrade`: the team file's `about` as this CLI says it — a lead count, a role it learnt — its agents and leads
 * left as the project has them. Answers whether it was out of date; written only when `write`. No file, or one that is
 * not a team (refused when a run reads it), nothing.
 */
export const refreshTeamAbout = async (root: string, write: boolean): Promise<boolean> => {
  const team = await readTeam(root).catch(() => undefined);
  if (!team || JSON.stringify(team.about) === JSON.stringify(TEAM_ABOUT)) {
    return false;
  }

  if (write) {
    await writeTeam(root, team);
  }

  return true;
};

/**
 * `plitzi run team set <name>`: one agent of the team made or changed — `lead` the lead's model — and what it was before
 * said with what it is now. A new agent needs its roles; nothing else of the file is touched.
 */
export const setTeamAgent = async (root: string, name: string, change: TeamAgentChange): Promise<TeamChange> => {
  const team = (await readTeam(root)) ?? { version: 1, agents: [] };
  if (name === 'lead') {
    if (change.roles !== undefined) {
      throw new RunRefusal(
        'invalid',
        'The leads take no roles — they plan and review: give them a --model (and --effort), or how many with --count'
      );
    }

    if (change.model === undefined && change.count === undefined && change.effort === undefined) {
      throw new RunRefusal(
        'invalid',
        'Say what of the leads changes: plitzi run team set lead --model claude-opus-5-5 | --count 2'
      );
    }

    const lead: Lead = {
      ...team.lead,
      ...(change.model !== undefined ? { model: change.model } : {}),
      ...(change.effort !== undefined ? { effort: change.effort } : {}),
      ...(change.count !== undefined ? { count: change.count } : {})
    };
    if (!isLeadEntry(lead)) {
      throw new RunRefusal('invalid', `The leads are 1 to ${String(MAX_LEADS)}, and their model a name: --count 2`);
    }

    if (team.lead && JSON.stringify(team.lead) === JSON.stringify(lead)) {
      return { name, before: team.lead, after: lead, file: TEAM_FILE, unchanged: true };
    }

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

  // Asked for what it already is: not an error — the team is as asked — and said, with nothing written.
  if (before && JSON.stringify(before) === JSON.stringify(after)) {
    return { name, before, after, file: TEAM_FILE, unchanged: true };
  }

  await writeTeam(root, {
    ...team,
    agents: before ? team.agents.map(each => (each.name === name ? after : each)) : [...team.agents, after]
  });

  return { name, ...(before ? { before } : {}), after, file: TEAM_FILE };
};

/** `plitzi run team unset <name>`: one agent out of the team — or, for `lead`, the leads' model and count. */
export const unsetTeamAgent = async (root: string, name: string): Promise<TeamChange> => {
  const team = await readTeam(root);
  if (name === 'lead') {
    if (!team?.lead) {
      throw new RunRefusal('invalid', `The leads have nothing of their own to take out (${TEAM_FILE})`);
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
