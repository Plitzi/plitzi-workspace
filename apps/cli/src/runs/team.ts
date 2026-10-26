import fs from 'node:fs/promises';
import path from 'node:path';

import { closest } from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import { HARNESSES, isHarness } from './agentPrompt';
import { QUALITIES } from './model';
import { RunRefusal } from './refusal';
import { formattedJson } from '../scaffold/formattedJson';

import type { Harness } from './agentPrompt';
import type { Quality, RunPlan } from './model';

/**
 * Who works this project's runs: the project's own choice, in `.plitzi/team.json` — committed, so the team
 * shares it — that a person edits, or asks an agent to change with `plitzi run team set`. The lead, and the agents it
 * starts: each with the roles it takes, how many of it, and the model to start it with. How many agents a run has is
 * the team's size; a task whose role nobody in the team takes is refused at `run plan`; a designer reviews the UI of the
 * others' tasks; a tester reviews every task — its QA, the task's approval — and with one in the team each developer task
 * gets a task of its tests, a developer's that did not write it (`tests.ts`); a scout finds out what the spikes ask.
 *
 * One lead, the manager: it plans with the person, approves the tasks a spike proposes, answers, decides what is escalated
 * to it and finishes — it reviews no task while the team has a tester. It is the person's harness, and never started
 * again: what it reads stays read on every turn after, so the work that reads much is the agents'.
 *
 * The CLI starts no agent: the lead's harness does, and reads here what to start each with — `run plan` says it agent by
 * agent. A model is the harness's own name for it (`claude-sonnet-5-5`, `openrouter/…`): nothing is checked but that one
 * is named.
 *
 * ```json
 * { "version": 1, "lead": { "model": "claude-opus-5-5", "effort": "high" },
 *   "agents": [{ "name": "dev", "roles": ["developer"], "count": 2, "model": "claude-sonnet-5-5" },
 *              { "name": "design", "roles": ["designer"], "model": "claude-opus-5-5" },
 *              { "name": "test", "roles": ["tester"], "model": "claude-opus-5-5" },
 *              { "name": "scout", "roles": ["scout"], "model": "claude-opus-5-5" }] }
 * ```
 */

export const TEAM_FILE = path.join('.plitzi', 'team.json');

/** The file's JSON Schema, shipped with the CLI, as `.plitzi/team.json` reaches it: the editor checks it as it is typed. */
export const TEAM_SCHEMA = '../node_modules/@plitzi/cli/schemas/team.schema.json';

/** The role of a task that says none. */
export const DEVELOPER = 'developer';
export const DESIGNER = 'designer';
export const TESTER = 'tester';
export const SCOUT = 'scout';

/** The strongest model a team is started with, where a role's work asks for it. */
const STRONGEST = 'claude-opus-5-5';

/**
 * The model a role starts on when the team names none: the designer's eye Sonnet lacked (a run's UI came back
 * mediocre); the tester's — its review is the task's approval, what stops a bug or a regression getting through (the
 * tests themselves are a developer's work, on Sonnet); the scout's — what a spike finds is what every task after it is made of (Carlos). Any other role,
 * the harness's own; the file's model, when it says one, always wins.
 */
export const ROLE_MODELS: Readonly<Partial<Record<string, string>>> = {
  [DESIGNER]: STRONGEST,
  [TESTER]: STRONGEST,
  [SCOUT]: STRONGEST
};

/** The model an agent of these roles starts on when its entry names none. */
const roleModel = (roles: readonly string[]): string | undefined =>
  roles.map(role => ROLE_MODELS[role]).find(model => model !== undefined);

export { QUALITIES };
export type { Quality };

export const qualityRank = (quality: Quality): number => QUALITIES.indexOf(quality);

export const isQuality = (value: unknown): value is Quality =>
  typeof value === 'string' && (QUALITIES as readonly string[]).includes(value);

/** The model to start with: one for every task, or one a level — `{ "standard": "…", "high": "…" }`. */
export type ModelChoice = string | Partial<Record<Quality, string>>;

const isModelChoice = (value: unknown): value is ModelChoice =>
  (typeof value === 'string' && value.trim() !== '') ||
  (isRecord(value) &&
    Object.keys(value).length > 0 &&
    Object.entries(value).every(
      ([level, model]) => isQuality(level) && typeof model === 'string' && model.trim() !== ''
    ));

/**
 * The model a choice starts a task of `quality` with: the one for its level — else the next level up, a stronger model
 * for a task none was named for — else the strongest named. One model for all is that model.
 */
export const modelFor = (choice: ModelChoice | undefined, quality: Quality): string | undefined => {
  if (choice === undefined || typeof choice === 'string') {
    return choice;
  }

  const up = QUALITIES.slice(qualityRank(quality)).find(level => choice[level] !== undefined);
  const down = [...QUALITIES].reverse().find(level => choice[level] !== undefined);

  return choice[up ?? down ?? quality];
};

/** A choice, said: `claude-sonnet-5-5`, or `standard claude-sonnet-5-5 · high claude-opus-5-5`. */
export const choiceText = (choice: ModelChoice): string =>
  typeof choice === 'string'
    ? choice
    : QUALITIES.flatMap(level => (choice[level] ? [`${level} ${choice[level]}`] : [])).join(' · ');

/** `--model`, as a person writes it: one name, or `standard=claude-sonnet-5-5,high=claude-opus-5-5`. */
export const parseModelChoice = (text: string): ModelChoice =>
  text.includes('=')
    ? Object.fromEntries(
        text.split(',').map(pair => {
          const [level, model] = pair.split('=').map(each => each.trim());

          return [level, model];
        })
      )
    : text;

export interface Model {
  model: string;
}

/**
 * How hard an agent thinks — Claude Code's `--effort`, Codex's reasoning effort — left to the harness when not said: one
 * word for every harness, as a model is one name. A word the harness does not take would have it refuse to start.
 */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];

export const isEffort = (value: unknown): value is Effort => EFFORTS.some(each => each === value);

export interface TeamAgent {
  /** What its agents are called: `dev` is `dev-1`, `dev-2`… — the `--agent` each takes its tasks with. */
  name: string;
  roles: string[];
  /** How many agents of it; one when not said. */
  count?: number;
  /** How many start with the run: the rest are on demand — started when work waits for them, stopped when none is left. */
  min?: number;
  model?: ModelChoice;
  effort?: Effort;
  /** When each of its agents is started again with a fresh context (`SessionMode`): `DEFAULT_SESSION` when not said. */
  session?: SessionMode;
  /**
   * Started again after it died with a task in hand — the machine down, the harness killed — it resumes its own session
   * (`--resume`, Claude Code's), what it knew and had not written yet with it, rather than a fresh one that reads the
   * task again. Four agents went down with the machine mid-task. Not a session larger than
   * `DEFAULTS.resumeMaxBytes` — reading it again would cost more than starting over — nor a harness that keeps none.
   */
  resumeSession?: boolean;
  /**
   * The skill its agents read first, a file of the project — `.claude/skills/accessibility/SKILL.md`: what a role of the
   * project's own does, which the CLI cannot say. Read beside the CLI's half of a role it knows.
   */
  skill?: string;
}

/**
 * When an agent is started again with a fresh context — always between two pieces of work (a task completed, a review
 * decided), never in one, so nothing it knows and has not written is lost:
 * - `task` (`DEFAULT_SESSION`): after each one;
 * - `context`: once its context passes the team's `freshContextAt`;
 * - `keep`: never — one session while it runs.
 *
 * Every turn reads the whole context again: a run's developers, a session a task, read ~12k tokens' worth a turn;
 * its designer and tester, never started again, grew to 400k and read 26–30k a turn — more, the two, than three
 * developers' 49 sessions. The lead that plans is never started again: it is the one the person talks to.
 */
export type SessionMode = 'task' | 'context' | 'keep';

export const SESSION_MODES: readonly SessionMode[] = ['task', 'context', 'keep'];

/** Every agent's session but the planning lead's, when its entry says none (Carlos: "por defecto es task"). */
export const DEFAULT_SESSION: SessionMode = 'task';

const isSessionMode = (value: unknown): value is SessionMode =>
  typeof value === 'string' && (SESSION_MODES as readonly string[]).includes(value);

/** The context an agent is started again past when the team says none (`TeamOptions.freshContextAt`), in tokens. */
export const FRESH_CONTEXT_AT = 250_000;

/**
 * The least `freshContextAt` takes: an agent's context starts at ~46k (its harness, its prompt, the brief) — below it,
 * every piece of work would end in a start.
 */
const MIN_FRESH_CONTEXT_AT = 60_000;

/** The lead's entry: its model and effort. One lead: the testers review. */
export interface Lead {
  model?: ModelChoice;
  effort?: Effort;
}

export interface Team {
  /** Where an editor finds what the file holds (`TEAM_SCHEMA`): it marks a wrong field as it is typed. */
  $schema?: string;
  version: 1;
  lead?: Lead;
  agents: TeamAgent[];
  /** How the team works, beside who is in it. */
  options?: TeamOptions;
  /**
   * What the file's fields and the roles mean, for the person who edits it (`TEAM_ABOUT`): JSON has no comments. The
   * CLI's: never read, written as this CLI says it whenever the file is written, and brought up by `plitzi upgrade`.
   */
  about?: Record<string, unknown>;
}

export interface TeamOptions {
  /**
   * How closely a designer reviews another task's UI (`light`, `standard`, `high`): its own pages in one scheme, or both
   * schemes and widths against the reference, or every page that reads its files against the run before it. A review
   * costs what it looks at — a run's strictest took 83 steps, more than the task it reviewed.
   */
  designReview?: Quality;
  /**
   * How long an agent just started may say nothing before the tasks it holds read "no signal": its harness loading, its
   * skills read. Every agent started again after the machine went down read "no signal" at once — its last word
   * was from before — and `run watch` woke the lead for it. `DEFAULTS.startGraceMs` when not said.
   */
  startGraceMinutes?: number;
  /**
   * The harness the CLI starts the agents in by itself (`claude`, `codex`, `opencode`): `run watch` starts
   * each agent the run asks for — one on demand, one of one task a session, a task's owner it was sent back to, a
   * designer for a UI review — instead of waking the lead to. Tasks waited 24 to 56 min to be taken while the
   * lead, planning or reviewing, was the only one to start agents. Not said: the lead starts them.
   */
  launch?: Harness;
  /**
   * The context, in tokens, past which an agent of `"session": "context"` is started again with a fresh one, between two
   * pieces of work (`SessionMode`). `FRESH_CONTEXT_AT` when not said — 250k (Carlos: 100k fills in a task or two; an
   * agent's context starts at ~46k and a task adds 30–60k).
   */
  freshContextAt?: number;
}

/** The longest an agent just started may say nothing (`TeamOptions.startGraceMinutes`). */
const MAX_START_GRACE_MINUTES = 30;

/** The options as the file says them, each kept only as it is valid — `teamProblems` says what is not. */
const isFreshContextAt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= MIN_FRESH_CONTEXT_AT;

const optionsOf = (options: Record<string, unknown>): TeamOptions => {
  const grace = options.startGraceMinutes;

  return {
    ...(isQuality(options.designReview) ? { designReview: options.designReview } : {}),
    ...(typeof grace === 'number' && Number.isInteger(grace) && grace >= 1 && grace <= MAX_START_GRACE_MINUTES
      ? { startGraceMinutes: grace }
      : {}),
    ...(isHarness(options.launch) ? { launch: options.launch } : {}),
    ...(isFreshContextAt(options.freshContextAt) ? { freshContextAt: options.freshContextAt } : {})
  };
};

/** How closely a designer reviews when the team says nothing. */
export const DEFAULT_DESIGN_REVIEW: Quality = 'standard';

/**
 * The roles the CLI knows, and what each does in a run: a task names one (`"role"`), an agent takes some. Any other
 * name is a role of the project's own — a task names it and an agent of the team takes it, with nothing more to it.
 */
export const ROLES = {
  developer: 'Writes the code of a task: the role of a task that names none.',
  designer:
    'Designs (tasks of its own), and reviews the UI/UX of the tasks of other roles before the tester, as a designer.',
  reviewer: 'Reviews as a task of its own: an accessibility pass, a code audit — and fixes what it finds.',
  tester:
    'QA: reviews every task in review — what it was asked, its checks, how it behaves, its code, its tests; its approval is the task’s — and escalates to the lead what it cannot decide. With one in the team, each developer task gets a task of its tests (<task>-tests), written by a developer that did not write it — the tester only when no developer may. With no tester, the lead reviews every task.',
  scout:
    'Finds out: the run’s scope and every spike — reads, measures, compares — and hands the lead what it found and the tasks it makes, which the lead approves. It answers no agent’s question (the lead does), and stops once no spike is left.',
  writer: 'Writes the words: the copy of a page, the docs, the help.'
} as const;

/** One agent of the team, as it is started: its own name, its roles, its model. */
export interface StartedAgent {
  agent: string;
  roles: string[];
  model?: Model;
  effort?: Effort;
  /**
   * The level it is started at, when the team names a model a level: one started agent each (`design-1-high`), handed
   * tasks of it or below (`task next --quality`).
   */
  quality?: Quality;
  /** Past its group's `min`: started when work waits for it, and it stops once none is left (`onDemand.ts`). */
  onDemand?: true;
  /** When it is started again with a fresh context (`TeamAgent.session`); `DEFAULT_SESSION` when not said. */
  session?: Exclude<SessionMode, typeof DEFAULT_SESSION>;
  /** Resumes its own session when started again after it died with a task in hand (`TeamAgent.resumeSession`). */
  resumeSession?: true;
  /** The skill it reads first (`TeamAgent.skill`), relative to the project. */
  skill?: string;
}

/** A role's or an agent's name, as a plan writes one. */
const NAME = /^[a-z][a-z0-9_-]{0,63}$/;
const MAX_COUNT = 16;

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(each => typeof each === 'string');

const isLeadEntry = (value: unknown): value is Lead =>
  isRecord(value) &&
  (value.model === undefined || isModelChoice(value.model)) &&
  (value.effort === undefined || isEffort(value.effort));

/** A skill's path: a markdown file inside the project, said from its folder. */
const isSkillPath = (value: unknown): value is string =>
  typeof value === 'string' && value.endsWith('.md') && !path.isAbsolute(value) && !value.split(/[\\/]/).includes('..');

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

  const count = typeof value.count === 'number' ? value.count : 1;
  if (
    value.min !== undefined &&
    (typeof value.min !== 'number' || !Number.isInteger(value.min) || value.min < 0 || value.min > count)
  ) {
    return `"${name}": its min — how many start with the run — is a whole number from 0 (every one on demand) to its count (${String(count)})`;
  }

  if (value.model !== undefined && !isModelChoice(value.model)) {
    return `"${name}": its model is the harness’s name for one — "claude-sonnet-5-5" — or one a level: { "standard": "claude-sonnet-5-5", "high": "claude-opus-5-5" } (${QUALITIES.join(', ')})`;
  }

  if (value.effort !== undefined && !isEffort(value.effort)) {
    return `"${name}": its effort is how hard it thinks — ${EFFORTS.join(', ')} — or left out for the harness's own`;
  }

  if (value.sessionPerTask !== undefined) {
    return `"${name}": "sessionPerTask" is gone: a fresh session after each task or review is every agent's now — remove it ("session": "context" starts it again only past options.freshContextAt, "keep" never)`;
  }

  if (value.session !== undefined && !isSessionMode(value.session)) {
    return `"${name}": its session is ${SESSION_MODES.join(', ')} — when it is started again with a fresh context: after each task or review (the default), past options.freshContextAt, or never`;
  }

  if (value.skill !== undefined && !isSkillPath(value.skill)) {
    return `"${name}": its skill is a markdown file of the project, by its path from it — ".claude/skills/accessibility/SKILL.md"`;
  }

  if (value.resumeSession !== undefined && typeof value.resumeSession !== 'boolean') {
    return `"${name}": its resumeSession is true — its own session resumed after it died with a task in hand — or false`;
  }

  return undefined;
};

const isTeamAgent = (value: unknown): value is TeamAgent => agentProblem(value) === undefined;

const TEAM_KEYS = ['$schema', 'version', 'lead', 'agents', 'options', 'about'];
const OPTION_KEYS = ['designReview', 'startGraceMinutes', 'launch', 'freshContextAt'];
const LEAD_KEYS = ['model', 'effort'];
const AGENT_KEYS = ['name', 'roles', 'count', 'min', 'model', 'effort', 'session', 'resumeSession', 'skill'];

/** A key the file does not know — a typo, most often — said with the one it likely meant: it would be read as nothing. */
const unknownKeys = (value: object, known: readonly string[], where: string): string[] =>
  Object.keys(value)
    .filter(key => !known.includes(key))
    .map(key => {
      const near = closest(key, known);

      return `${where}"${key}" is no field of it${near ? ` — did you mean "${near}"?` : ''} (it takes ${known.filter(each => each !== '$schema').join(', ')})`;
    });

/**
 * Everything wrong with a team file, at once — what `run plan` refuses it for, and `plitzi doctor` and `run team check`
 * say: a person edits it by hand, and a key misspelt would be read as nothing.
 */
export const teamProblems = (parsed: unknown): string[] => {
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.agents)) {
    return ['it is { "version": 1, "lead"?: { "model": "…" }, "agents": [ … ] }'];
  }

  const problems = unknownKeys(parsed, TEAM_KEYS, '');
  if (parsed.lead !== undefined) {
    if (!isLeadEntry(parsed.lead)) {
      problems.push(`"lead" is { "model"?: "…", "effort"?: ${EFFORTS.join(' | ')} }`);
    } else {
      problems.push(...unknownKeys(parsed.lead, LEAD_KEYS, '"lead": '));
    }
  }

  for (const each of parsed.agents) {
    const problem = agentProblem(each);
    if (problem !== undefined) {
      problems.push(problem);
    } else if (isRecord(each)) {
      problems.push(...unknownKeys(each, AGENT_KEYS, `"${String(each.name)}": `));
    }
  }

  if (parsed.options !== undefined) {
    if (!isRecord(parsed.options)) {
      problems.push(
        '"options" is { "designReview"?: "light" | "standard" | "high", "startGraceMinutes"?: 1 to 30, "launch"?: "claude" | "codex" | "opencode", "freshContextAt"?: tokens }'
      );
    } else {
      problems.push(...unknownKeys(parsed.options, OPTION_KEYS, '"options": '));
      if (parsed.options.designReview !== undefined && !isQuality(parsed.options.designReview)) {
        problems.push(`"options": "designReview" is ${QUALITIES.join(', ')} — how closely a designer reviews`);
      }

      if (parsed.options.launch !== undefined && !isHarness(parsed.options.launch)) {
        problems.push(
          `"options": "launch" is the harness the CLI starts the agents in — ${HARNESSES.join(', ')} — or left out for the lead to start them`
        );
      }

      if (parsed.options.freshContextAt !== undefined && !isFreshContextAt(parsed.options.freshContextAt)) {
        problems.push(
          `"options": "freshContextAt" is the context, in tokens, past which an agent is started again fresh — a whole number from ${String(MIN_FRESH_CONTEXT_AT)}; ${String(FRESH_CONTEXT_AT)} when not said`
        );
      }

      const grace = parsed.options.startGraceMinutes;
      if (
        grace !== undefined &&
        (typeof grace !== 'number' || !Number.isInteger(grace) || grace < 1 || grace > MAX_START_GRACE_MINUTES)
      ) {
        problems.push(
          `"options": "startGraceMinutes" is a whole number from 1 to ${String(MAX_START_GRACE_MINUTES)} — how long an agent just started may say nothing`
        );
      }
    }
  }

  const names = parsed.agents.filter(isTeamAgent).map(agent => agent.name);
  const repeated = names.filter((name, index) => names.indexOf(name) !== index);
  if (repeated.length > 0) {
    problems.push(`${[...new Set(repeated)].map(name => `"${name}"`).join(', ')} is in the team twice`);
  }

  return problems;
};

/**
 * What is wrong with the project's team file, as `plitzi doctor` and `run team check` say it — `undefined` when there is
 * no file (a project's first run writes one). Read as it is on disk: nothing is written.
 */
export const checkTeamFile = async (root: string): Promise<string[] | undefined> => {
  const text = await fs.readFile(path.join(root, TEAM_FILE), 'utf-8').catch(() => undefined);
  if (text === undefined) {
    return undefined;
  }

  try {
    return teamProblems(JSON.parse(text));
  } catch {
    return ['it is not JSON — a comma or a quote, most often: fix it, or remove the file to have no team'];
  }
};

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

  const problems = teamProblems(parsed);
  if (problems.length > 0 || !isRecord(parsed) || !Array.isArray(parsed.agents)) {
    throw new RunRefusal('invalid', `${TEAM_FILE}:\n${problems.map(each => `  - ${each}`).join('\n')}`, { problems });
  }

  return {
    $schema: TEAM_SCHEMA,
    version: 1,
    ...(isLeadEntry(parsed.lead) ? { lead: parsed.lead } : {}),
    agents: parsed.agents.filter(isTeamAgent),
    ...(isRecord(parsed.options) ? { options: optionsOf(parsed.options) } : {}),
    ...(isRecord(parsed.about) ? { about: parsed.about } : {})
  };
};

/**
 * What the file's fields and the roles mean, kept in it for the person who edits it: JSON has no comments. Models are
 * left to the harness — the file says how to choose one, in whichever harness runs the agents.
 */
export const TEAM_ABOUT: Record<string, unknown> = {
  file: 'Who works the runs of several agents on this project (plitzi run). Edit it, or: plitzi run team set <name> --roles … --count … --model …',
  lead: 'The lead is the manager, the one you talk to: it plans with you, approves the tasks a spike proposes, answers, decides what a tester escalates and closes — looking at the whole result once before it does. It reviews no task while the team has a tester (with none, every one). Give it your strongest model: "lead": { "model": "…", "effort": "high" } (plitzi run team set lead --model …).',
  agents:
    'Each agent: a name (dev is dev-1, dev-2…), the roles it takes, how many of it (count), and the model to start it with, as the harness names it (claude-sonnet-5-5 in Claude Code; any model opencode or another harness takes); left out, the default of the harness. "effort": how hard it thinks — low, medium, high, xhigh, max — left out, the harness’s own (Claude Code’s effort, Codex’s reasoning effort). Or a model a quality level — "model": { "standard": "claude-sonnet-5-5", "high": "claude-opus-5-5" } (light, standard, high): each level is started apart (design-1-high) for the tasks of it, so the strongest model works only what many build on. How many agents work at once is the sum of the counts; "min" (from 0 to its count) starts only that many with the run, the rest on demand — started when work waits for it (run watch says which), and it stops once none is left; 0, every one on demand. "session": when its agents are started again with a fresh context, always between two pieces of work (a task completed, a review decided), never in one — "task" (the default) after each one, "context" once its context passes options.freshContextAt, "keep" never: every turn reads the whole context again, so a context that grew costs on every turn after (plitzi run team set dev --session context). The lead keeps its session: it is the one you talk to. "resumeSession": true resumes an agent\'s own session when it is started again after it died with a task in hand — what it knew and had not written yet kept; Claude Code alone, and not a session past a size that would cost more to read again than to start over (plitzi run team set dev --resume-session). "skill": a markdown file of the project its agents read first — what a role of your own does (plitzi run team set a11y --roles accessibility --skill .claude/skills/accessibility/SKILL.md).',
  roles: { ...ROLES, '<any other>': 'A role of your own: a task names it, an agent takes it.' },
  options:
    '"designReview": how closely a designer reviews another task\'s UI — "light" (its pages at 1440 and 390, the default scheme, nothing it does not touch), "standard" (both schemes and widths, its sections against the reference; the default), "high" (every page that reads its files, against the run before it too). A review costs what it looks at. "startGraceMinutes": how long an agent just started may say nothing before the tasks it holds read \'no signal\' — 3 when not said. "launch": the harness (claude, codex, opencode) the CLI starts the agents in by itself when the run asks for one — left out, the lead starts them. "freshContextAt": the context, in tokens, past which an agent of "session": "context" is started again fresh — 250000 when not said.',
  more: 'It starts small — every agent spends tokens, and only one developer starts with the run: a second developer, a designer who reviews the UI of every other task, a tester who reviews every task (its tests written by a developer that did not write it), and a scout who finds out what the spikes ask — each started when work waits for it. The developers on Sonnet, the others and the lead on Opus. Grow it when a job asks — you decide: more developers (plitzi run team set dev --count 3 --min 2), a second tester when reviews queue (plitzi run team set test --count 2), a writer.'
};

/**
 * The team a project starts with — one to two developers, and none to one tester, scout and designer (Carlos): only one
 * developer with the run, every other started when work waits for it — few agents at once, the person growing it when
 * a job asks.
 */
export const STARTER_TEAM: Team = {
  $schema: TEAM_SCHEMA,
  version: 1,
  about: TEAM_ABOUT,
  // The models are the file's, never the CLI's: the lead — who plans and decides — on the strongest, thinking hard; the
  // designer too, whose eye Sonnet lacked (a run's UI came back mediocre); the tester, whose approval is the task's, and
  // the scout, whose findings every task is made of — on it too (Carlos); developers on Sonnet, which works a task as
  // well for less. One the file leaves out is the harness's own.
  lead: { model: STRONGEST, effort: 'high' },
  agents: [
    { name: 'dev', roles: [DEVELOPER], count: 2, min: 1, model: 'claude-sonnet-5-5', resumeSession: true },
    { name: 'design', roles: [DESIGNER], min: 0, model: STRONGEST, resumeSession: true },
    { name: 'test', roles: [TESTER], min: 0, model: STRONGEST, resumeSession: true },
    { name: 'scout', roles: [SCOUT], min: 0, model: STRONGEST, resumeSession: true }
  ]
};

/** The team a plan needs at least: the starter's, and one agent for each other role it names. */
const teamFor = (plan: Pick<RunPlan, 'tasks'>): Team => {
  const roles = [...new Set(plan.tasks.map(task => task.role ?? DEVELOPER))];

  return {
    ...STARTER_TEAM,
    agents: [
      ...STARTER_TEAM.agents,
      ...roles
        .filter(role => !teamTakes(STARTER_TEAM, role))
        .map(role => ({ name: role, roles: [role], ...(ROLE_MODELS[role] ? { model: ROLE_MODELS[role] } : {}) }))
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
    created: `This project had no team: ${TEAM_FILE} written with what the plan needs — ${team.agents.map(teamAgentText).join('; ')} — each on the model it names, the harness's own where none, and what each field and role means. Change it with plitzi run team set <name> --roles … --count … --model … (a lead model, a designer who reviews the UI, a tester who reviews every task)`
  };
};

/** Each agent of the team as it is started — `dev-1`, `dev-2`… — in the file's order. */
export const startedAgents = (team: Team): StartedAgent[] =>
  team.agents.flatMap(each =>
    Array.from({ length: each.count ?? 1 }, (_, index): StartedAgent[] => {
      const name = `${each.name}-${String(index + 1)}`;
      const effort = each.effort ? { effort: each.effort } : {};
      const demand = {
        ...(each.min !== undefined && index >= each.min ? { onDemand: true as const } : {}),
        ...(each.session === 'context' || each.session === 'keep' ? { session: each.session } : {}),
        ...(each.resumeSession === true ? { resumeSession: true as const } : {}),
        ...(each.skill === undefined ? {} : { skill: each.skill })
      };
      if (each.model === undefined || typeof each.model === 'string') {
        return [
          {
            agent: name,
            roles: each.roles,
            ...(each.model ? { model: { model: each.model } } : {}),
            ...effort,
            ...demand
          }
        ];
      }

      const choice = each.model;

      return QUALITIES.flatMap(level => {
        const model = choice[level];

        return model
          ? [{ agent: `${name}-${level}`, roles: each.roles, model: { model }, ...effort, quality: level, ...demand }]
          : [];
      });
    }).flat()
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

/** The skills the team names that the project does not have, each said with its agent: one read first, and missing. */
export const skillProblems = async (root: string, team: Team): Promise<string[]> =>
  (
    await Promise.all(
      team.agents.map(async each =>
        each.skill === undefined ||
        (await fs.stat(path.join(root, each.skill)).then(
          found => found.isFile(),
          () => false
        ))
          ? []
          : [
              `"${each.name}" reads ${each.skill} first (${TEAM_FILE}), and the project has no such file: write it, or point "skill" at the one there is`
            ]
      )
    )
  ).flat();

/** The tasks of the plan whose role nobody in the team takes, said with the fix. */
export const roleProblems = (plan: Pick<RunPlan, 'tasks'>, team: Team): string[] =>
  plan.tasks
    .filter(task => !teamTakes(team, task.role ?? DEVELOPER))
    .map(
      task =>
        `Task "${task.id}" is a ${task.role ?? DEVELOPER}'s, and nobody in the team (${TEAM_FILE}) takes ${task.role ?? DEVELOPER}: give it a role the team has, or add one (plitzi run team set <name> --roles ${task.role ?? DEVELOPER})`
    );

/** What an agent is started on, said: its model and effort, each the harness's own where the team names none. */
export const startText = (started: Pick<StartedAgent, 'model' | 'effort'>): string =>
  `${started.model?.model ?? 'the harness’s own model'}${started.effort ? ` (${started.effort} effort)` : ''}`;

/** The model the lead is started with, said. */
export const leadModelText = (lead: Lead | undefined): string =>
  `${lead?.model ? choiceText(lead.model) : 'the harness’s own model'}${lead?.effort ? ` (${lead.effort} effort)` : ''}`;

/** What the lead is started on: the team's model for it, the strongest it names, and its effort. */
export const leadStart = (lead: Lead | undefined): Pick<StartedAgent, 'model' | 'effort'> => {
  const named = lead?.model === undefined ? undefined : modelFor(lead.model, 'high');

  return { ...(named ? { model: { model: named } } : {}), ...(lead?.effort ? { effort: lead.effort } : {}) };
};

/** The lead's entry, as `run team` says it. */
export const leadText = (lead: Lead | undefined): string => leadModelText(lead);

/** One agent of the team, as `run team` says it. */
export const teamAgentText = (each: TeamAgent): string =>
  `${each.name}${(each.count ?? 1) > 1 ? ` × ${String(each.count)}` : ''}${each.min !== undefined && each.min < (each.count ?? 1) ? ` (${String(each.min)} at the start, the rest on demand)` : ''} — ${each.roles.join(', ')}${each.model ? ` — ${choiceText(each.model)}` : ''}${each.effort ? ` (${each.effort} effort)` : ''}${each.session === 'context' ? ' — a fresh session past options.freshContextAt' : each.session === 'keep' ? ' — one session while it runs' : ''}${each.resumeSession === true ? ' — resumes its session after a crash' : ''}${each.skill === undefined ? '' : ` — reads ${each.skill}`}`;

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
  min?: number;
  model?: ModelChoice;
  effort?: Effort;
  session?: SessionMode;
  resumeSession?: boolean;
  skill?: string;
}

const writeTeam = async (root: string, team: Team): Promise<void> => {
  await fs.mkdir(path.join(root, path.dirname(TEAM_FILE)), { recursive: true });
  await fs.writeFile(path.join(root, TEAM_FILE), formattedJson({ $schema: TEAM_SCHEMA, ...team, about: TEAM_ABOUT }));
};

/**
 * `plitzi upgrade`: the team file's `about` as this CLI says it — a lead count, a role it learnt — its agents and leads
 * left as the project has them. Answers whether it was out of date; written only when `write`. No file, or one that is
 * not a team (refused when a run reads it), nothing.
 */
export const refreshTeamAbout = async (root: string, write: boolean): Promise<boolean> => {
  const team = await readTeam(root).catch(() => undefined);
  const text = await fs.readFile(path.join(root, TEAM_FILE), 'utf-8').catch(() => '');
  if (!team || (JSON.stringify(team.about) === JSON.stringify(TEAM_ABOUT) && text.includes(TEAM_SCHEMA))) {
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
    if (change.roles !== undefined || change.count !== undefined) {
      throw new RunRefusal(
        'invalid',
        'The lead takes no roles and is one — it plans and decides; the testers review: give it a model or an effort — plitzi run team set lead --model <model> --effort <effort>; more reviewers are more testers — plitzi run team set test --count 2'
      );
    }

    if (change.model === undefined && change.effort === undefined) {
      throw new RunRefusal('invalid', 'Say what of the lead changes: plitzi run team set lead --model claude-opus-5-5');
    }

    const lead: Lead = {
      ...team.lead,
      ...(change.model !== undefined ? { model: change.model } : {}),
      ...(change.effort !== undefined ? { effort: change.effort } : {})
    };
    if (!isLeadEntry(lead)) {
      throw new RunRefusal(
        'invalid',
        `The lead's model is a name and its effort one of ${EFFORTS.join(', ')}: plitzi run team set lead --model claude-opus-5-5`
      );
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

  // A new entry of a role that asks for the strongest model starts on it, written in the file (`ROLE_MODELS`).
  const model = change.model ?? before?.model ?? (before === undefined ? roleModel(roles) : undefined);
  const after: TeamAgent = {
    name,
    roles,
    ...((change.count ?? before?.count) !== undefined ? { count: change.count ?? before?.count } : {}),
    ...((change.min ?? before?.min) !== undefined ? { min: change.min ?? before?.min } : {}),
    ...(model !== undefined ? { model } : {}),
    ...((change.effort ?? before?.effort) !== undefined ? { effort: change.effort ?? before?.effort } : {}),
    // The default is not written: the file says only what differs from it.
    ...((change.session ?? before?.session) !== undefined && (change.session ?? before?.session) !== DEFAULT_SESSION
      ? { session: change.session ?? before?.session }
      : {}),
    ...((change.resumeSession ?? before?.resumeSession) === true ? { resumeSession: true } : {}),
    ...((change.skill ?? before?.skill) !== undefined ? { skill: change.skill ?? before?.skill } : {})
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

/** `plitzi run team unset <name>`: one agent out of the team — or, for `lead`, the lead's model and effort. */
export const unsetTeamAgent = async (root: string, name: string): Promise<TeamChange> => {
  const team = await readTeam(root);
  if (name === 'lead') {
    if (!team?.lead) {
      throw new RunRefusal('invalid', `The lead has nothing of its own to take out (${TEAM_FILE})`);
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
