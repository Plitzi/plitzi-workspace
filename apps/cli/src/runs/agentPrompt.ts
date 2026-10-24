import path from 'node:path';

import { isPrincipal, LEAD_ROLE } from './leads';
import { SKILLS_ROOT } from '../scaffold/skills';

import type { StartedAgent } from './team';

/**
 * What an agent of a run is started with: who it is, where it works and the run's protocol in short — the skills say it
 * whole. Every run so far had its lead write these by hand (velada-shell's dev-1 and design-1, a page each): a person
 * new to Plitzi had nothing to start an agent with. `plitzi run agent <name>` writes it, and starts it when asked.
 */

/** The harnesses an agent is started in headless — each a command line of its own. */
export const HARNESSES = ['claude', 'codex', 'opencode'] as const;

export type Harness = (typeof HARNESSES)[number];

export const isHarness = (value: unknown): value is Harness =>
  typeof value === 'string' && (HARNESSES as readonly string[]).includes(value);

export interface PromptFor {
  /** The agent, as the team names it — or `lead`. */
  agent: string;
  /** Its roles and level, from the team; none for the lead. */
  started?: Pick<StartedAgent, 'roles' | 'quality' | 'sessionPerTask'>;
  runId: string;
  /** The project's folder. */
  root: string;
  /** Its own CLI (`writeCli`): the project's, passing its token — every command it runs. */
  cli: string;
  /** The run's goal: what the lead was asked. */
  goal: string;
  /**
   * The site the run copies, when it copies one: its lines measure and use what is built beside it. A run that copies
   * nothing — a translation, a feature — was told of an "original" it does not have.
   */
  reference?: string;
}

const skill = (root: string, file: string): string => path.join(root, SKILLS_ROOT, 'plitzi-cli', 'reference', file);

/** The rules every agent of a run holds to, whatever its role: said once, the skills saying why. */
const rules = (cli: string): string[] => [
  `- Never run \`${cli} run finish\`, \`run abort\`, \`run purge\`, \`run restore\`, \`run allow-finish\` or \`run stop --force\` — a person's. Never \`git stash\`, \`checkout\` or \`reset\`.`,
  // encore: a heredoc that never closed hung on stdin, and `pkill -f "cat"` to free it took the machine down.
  `- Stop a server with \`${cli} server stop --port <port>\` in the folder that started it — it stops that folder's alone; a command that hangs is your harness's to stop. Never \`pkill\`, \`killall\` nor a kill by name or pattern: they reach every process on the machine. Write files with your edit tools, never a heredoc through the shell.`,
  '- A wait that ends is not your end: run `task next` again until it says "You can stop".',
  // lx-controls: two agents read the bundle's types, every command's help and a site's HTML to learn what Plitzi had.
  '- Whether Plitzi has a way — a field, a step, a state, a command: `PLITZI explain --search "<words>"`, then `PLITZI explain <name>`; never the packages\' types nor a site\'s HTML fetched and searched. Nothing found that should be: `run notice --plitzi`.',
  '- Plitzi itself in your way — a refusal you think wrong, a command that cannot do what you need, a doc that misled you: say it as it happens, `PLITZI run notice --plitzi "…"` (the run\'s feedback to Plitzi carries it), and go on.',
  '- When it says you can stop, answer with a short report: what you did, what is uncertain, and every friction with the CLI — the command and what it said.'
];

/** An agent's prompt: the lead's, a lead's that reviews, or one of the team's by its roles. */
export const agentPrompt = ({ agent, started, runId, root, cli, goal, reference }: PromptFor): string => {
  // What a page is held to: the site it copies, beside it — or, with none, what the task asks.
  const beside = reference === undefined ? '' : ` --compare ${reference}`;
  // A control used, step by step, read as numbers — beside the copied site's when there is one.
  const playBeside =
    reference === undefined
      ? '--steps "click <el>; click <el>" --read <el…>'
      : `--steps "click <ours> => <theirs>; …" --read "<ours> => <theirs>" …${beside} --same moved,shown,enabled`;
  if (isPrincipal(agent)) {
    return [
      `You are the lead of a Plitzi multi-agent run on the project ${root} (run "${runId}"). The person asked: ${goal}`,
      '',
      `Read first, whole: ${skill(root, 'runs-lead.md')} and ${skill(root, 'runs.md')}.`,
      '',
      `- The CLI is ${cli} — your own: it says who you are on every command, so pass no --token nor --agent.`,
      `- The run opens on its scope, your spike: find out what the ask takes (${reference === undefined ? '`task show`, `page check`, `page shot`' : `\`page measure …${beside}\`, \`page outline …${beside}\`, \`page shot …${beside}\``}), then end it with the tasks, each with what you found: \`task spike s-scope --done "…" --tasks <stage.json>\` (a stage is its \`tasks\`).`,
      `- Start the team once there are tasks: \`${cli} run agent <name> --launch --harness <yours>\` for each agent \`run plan\` names; \`run watch --until lead\` wakes you for each review, question and block, and says when another agent is worth starting.`,
      '- Review each task: `task show` for its code, one `task look` for its pages, then `task review --approve | --changes "…"`. Then the report (`run report --summary`) and the dry finish (`run finish`): the person applies it.',
      '- What goes wrong in the CLI, note it (`run notice`) — it is fixed after the run, never during it.'
    ].join('\n');
  }

  const roles = started?.roles.join(',') ?? 'developer';
  const designer = started?.roles.includes('designer') === true;
  const coLead = started?.roles.includes(LEAD_ROLE) === true;
  const reading = [
    skill(root, 'runs.md'),
    ...(designer ? [skill(root, 'runs-designer.md')] : []),
    ...(coLead ? [skill(root, 'runs-lead.md')] : [])
  ];

  return [
    `You are ${agent}, a ${roles} agent of a Plitzi multi-agent run on the project ${root} (run "${runId}"). The lead is another agent; a person applies the final merge — never you.`,
    '',
    `Read first, whole: ${reading.join(' and ')}${designer ? ' — and, before your first review, what it names to read' : ''}.`,
    '',
    `- The CLI is ${cli} (PLITZI below) — your own: it says who you are on every command, inside a task's copy too, so pass no --token nor --agent. Start with \`cd ${root} && PLITZI task next --role ${roles}${started?.quality ? ` --quality ${started.quality}` : ''} --follow --take\`.`,
    ...(coLead
      ? ['- You review what you are handed as strictly as the lead, and answer the questions handed to you.']
      : [
          "- Work only in the task's copy (the `work` folder its take prints): start with `PLITZI task context` there, and read the files you change yourself.",
          reference === undefined
            ? '- Measure, never guess — every element and width in one call: `PLITZI page measure <path> <elements…> --width 390,1440` (`--hover`, `--click` for a state; `PLITZI page outline <path> --within <part>` names them). Trying values, measure; never `task check` for it.'
            : `- Measure, never guess — every element and width in one call: \`PLITZI page measure <path> "<ours> => <theirs>" …${beside} --width 390,1440\` (\`--hover\`, \`--click\` for a state; \`PLITZI page outline <path>${beside} --within <part>\` names theirs). Trying values, measure; never \`task check\` for it.`,
          started?.sessionPerTask === true
            ? '- Change a batch, then `PLITZI task check` once; then `PLITZI task complete`, and `PLITZI task next --follow --take`. You work one task a session: once it is complete, task next says you can stop — stop then, with your report; the lead starts you again, a fresh context, for the next task, and for yours if it is sent back.'
            : '- Change a batch, then `PLITZI task check` once; then `PLITZI task complete`, and `PLITZI task next --follow --take` again.',
          // lx-controls: t-collection completed with "Known: the phone keeps our inline panel, where the original opens a
          // drawer" — sent back for exactly that.
          `- ${reference === undefined ? 'Something wrong you see' : 'A difference from the site you copy you see'}, inside your task's title, is work, not a note: do it, or \`PLITZI task ask\` the lead before you complete.`,
          // lx-controls: a person following the run read commands where an agent's row should say what it is at.
          '- As what you are at changes, say it in your words — `PLITZI task progress --step "the hero: its title sits 4px low, moving it"`: the person following the run reads it.',
          // lx-fidelity: Opiniones' arrow moved nothing at 1440, and its developer, its designer and the lead each passed it.
          `- A control you add or change — an arrow, a dot, a pager, a drawer — you use before you complete, there and back, at both widths${reference === undefined ? '' : ", beside the copied site's"}: \`PLITZI page play <path> ${playBeside} --width 390,1440\` — how far each step moved what, what it shows and takes a press; a picture is no proof of one.`
        ]),
    ...(designer
      ? [
          `- A review: one \`PLITZI task look <task>\` a round, then measure only what differs, and use each control it adds there and back (\`page play <path> ${playBeside}\`); send it back only for what its title and acceptance cover, with the values${reference === undefined ? '' : ' and one `--same` line that proves them'} — anything else is \`PLITZI run notice "…"\`. Say your verdict within 8 minutes.`
        ]
      : []),
    ...rules(cli)
  ].join('\n');
};

/** Shell-quoted, for a command line said to a person: what it runs, as it runs it. */
const quoted = (word: string): string => (/^[\w./:=@-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`);

/**
 * The command line that starts an agent in `harness`, headless — said with its prompt read from its file, run with the
 * prompt itself — and the model the team names for it, where the harness takes one. Claude Code is let run the shell
 * and edit files in the project: a run's agent does nothing else.
 */
/**
 * Whether a harness runs a model of that name: Claude Code a Claude one (`claude-…`, or its aliases), Codex any other,
 * opencode one written `provider/model`. The team's model is one name for every harness: one the harness does not run
 * would refuse to start the agent.
 */
export const harnessRuns = (harness: Harness, model: string): boolean =>
  harness === 'claude'
    ? /^(claude-|sonnet|opus|haiku)/.test(model)
    : harness === 'codex'
      ? !/^(claude-|sonnet|opus|haiku)/.test(model)
      : model.includes('/');

/**
 * The session an agent starts in, where the harness keeps one (Claude Code): a new one under an id of the CLI's
 * (`--session-id`), kept so it can be resumed — or that one resumed (`--resume`), the prompt then what it is told.
 */
export type HarnessSession = { id: string; resume: boolean };

export const harnessCommand = (
  harness: Harness,
  prompt: { file: string; text: string },
  model?: string,
  session?: HarnessSession
): { command: string; args: string[]; line: string; model?: string } => {
  const PROMPT = '\0prompt';
  // The team's model where this harness runs it; else the harness's own default, said by the caller.
  const runs = model !== undefined && harnessRuns(harness, model) ? model : undefined;
  const parts: string[] =
    harness === 'claude'
      ? [
          'claude',
          '-p',
          PROMPT,
          ...(session ? [session.resume ? '--resume' : '--session-id', session.id] : []),
          ...(runs ? ['--model', runs] : []),
          '--permission-mode',
          'acceptEdits',
          '--allowedTools',
          'Bash Read Edit Write Glob Grep'
        ]
      : harness === 'codex'
        ? ['codex', 'exec', '--full-auto', ...(runs ? ['-m', runs] : []), PROMPT]
        : ['opencode', 'run', ...(runs ? ['--model', runs] : []), PROMPT];
  const line = parts.map(part => (part === PROMPT ? `"$(cat ${prompt.file})"` : quoted(part))).join(' ');
  const [command = harness, ...args] = parts.map(part => (part === PROMPT ? prompt.text : part));

  return { command, args, line, ...(runs ? { model: runs } : {}) };
};
