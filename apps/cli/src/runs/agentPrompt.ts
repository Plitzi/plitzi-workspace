import path from 'node:path';

import { isPrincipal } from './leads';
import { DEVELOPER, SCOUT, TESTER } from './team';
import { SKILLS_ROOT } from '../scaffold/skills';

import type { Effort, StartedAgent } from './team';

/**
 * What an agent of a run is started with: who it is, where it works and the run's protocol in short — the skills say it
 * whole. Every run so far had its lead write these by hand (a run's dev-1 and design-1, a page each): a person
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
  started?: Pick<StartedAgent, 'roles' | 'quality' | 'session' | 'skill'>;
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
  /**
   * Whether the run opened on its scope (`s-scope`), or on a plan made before it: a run's lead told of a scope it did
   * not have asked for it, refused.
   */
  scoping?: boolean;
  /** Who the team has beside the developers: a scout finds out the spikes, a tester reviews — else the lead does. */
  team?: { scout: boolean; tester: boolean };
}

const skill = (root: string, file: string): string => path.join(root, SKILLS_ROOT, 'plitzi-cli', 'reference', file);

/** The rules every agent of a run holds to, whatever its role: said once, the skills saying why. */
const rules = (cli: string): string[] => [
  `- Never run \`${cli} run finish\`, \`run abort\`, \`run purge\`, \`run restore\` or \`run stop --force\` — a person's. Never \`git stash\`, \`checkout\` or \`reset\`.`,
  // A heredoc that never closed hung on stdin, and `pkill -f "cat"` to free it took the machine down.
  `- Stop a server with \`${cli} server stop --port <port>\` in the folder that started it — it stops that folder's alone; a command that hangs is your harness's to stop. Never \`pkill\`, \`killall\` nor a kill by name or pattern: they reach every process on the machine. Write files with your edit tools, never a heredoc through the shell.`,
  '- A wait that ends is not your end: run `task next` again until it says "You can stop".',
  // Two agents read the bundle's types, every command's help and a site's HTML to learn what Plitzi had.
  '- Whether Plitzi has a way — a field, a step, a state, a command: `PLITZI explain "<words>"`, then `PLITZI explain <name>`; never the packages\' types nor a site\'s HTML fetched and searched. Nothing found that should be: `run notice --plitzi`.',
  '- Plitzi itself in your way — a refusal you think wrong, a command that cannot do what you need, a doc that misled you: say it as it happens, `PLITZI run notice --plitzi "…"` (the run\'s feedback to Plitzi carries it), and go on.',
  '- When it says you can stop, answer with a short report: what you did, what is uncertain, and every friction with the CLI — the command and what it said. Between two tasks or reviews it may say so for a fresh context: the run starts you again with one, for what you hold and what comes.'
];

/** An agent's prompt: the lead's, or one of the team's by its roles. */
export const agentPrompt = ({
  agent,
  started,
  runId,
  root,
  cli,
  goal,
  reference,
  scoping = false,
  team = { scout: false, tester: false }
}: PromptFor): string => {
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
      `Read first, whole: ${skill(root, 'runs-plan.md')}, ${skill(root, 'runs-lead.md')}${team.tester ? '' : `, ${skill(root, 'runs-review.md')}`} and ${skill(root, 'runs.md')}.`,
      '',
      `- The CLI is ${cli} — your own: it says who you are on every command, so pass no --token nor --agent.`,
      // The lead is the person's harness, never started again: what it reads stays read every turn after (Carlos).
      "- You are the manager: you plan with the person, approve what a spike proposes, answer, decide what is escalated to you and finish. What reads much — finding out, reviewing — is the agents', in fresh contexts: everything you read stays in yours for the rest of the run.",
      scoping
        ? team.scout
          ? '- The run opens on its scope: a scout finds out what the ask takes and proposes the tasks. `task next --role lead` hands them to you — decide them with the person, then `task spike s-scope --approve | --changes "…"`.'
          : `- The run opens on its scope, your spike (the team has no scout): find out what the ask takes (${reference === undefined ? '`task show`, `page check`, `page shot`' : `\`page measure …${beside}\`, \`page outline …${beside}\`, \`page shot …${beside}\``}), then end it with the tasks, each with what you found: \`task spike s-scope --done "…" --tasks <stage.json>\` (a stage is its \`tasks\`).`
        : '- The run opened on a plan made before it: its tasks are on the board (`run status`), no scope to find out first — stack what is missing (`run extend`).',
      `- The team starts by itself when \`.plitzi/team.json\` says how (\`options.launch\`): the run's base as it opens, the rest when work waits — start none of them yourself. With no launch, \`${cli} run agent <name> --launch --harness <yours>\` starts each agent \`run plan\` names. \`run watch\` wakes you for what is yours: a proposal, a question, a block, what a tester escalates.`,
      team.tester
        ? '- A tester reviews every task, its approval the task\'s: read no review yourself. One it escalates, or past its review rounds, comes blocked on you — `task show` it, then `task review <task> --approve`, or `task unblock <task> --answer "…"` to send it back with your word. By default you review nothing else: one nobody else may take (each tester and developer worked it, or what it tests) would hold the run — `run watch` hands it you: `task show`, one `task look`, then `task review --approve | --changes "…"`.'
        : '- Review each task (the team has no tester): `task show` for its code, one `task look` for its pages, then `task review --approve | --changes "…"`.',
      '- Before you finish, look at the whole result once — `run look`, every page the run changed — then the report (`run report --summary`) and the dry finish (`run finish`): the person applies it.',
      // Told `run notice` of "the CLI" alone, the lead noted three of six problems — a skill naming a command the
      // CLI lacks, a platform gap an agent hit, a workaround a limit forced — and plain `run notice` is the project's backlog.
      '- Everything of Plitzi in your way — the CLI, the platform, a skill or doc that misled you, a workaround a limit forced on you — note it as it happens, one each with what it cost: `run notice --plitzi "…"` (the run\'s feedback to Plitzi carries it). Fixed after the run, never during it.'
    ].join('\n');
  }

  const roles = started?.roles.join(',') ?? 'developer';
  const designer = started?.roles.includes('designer') === true;
  const tester = started?.roles.includes(TESTER) === true;
  const scout = started?.roles.includes(SCOUT) === true;
  // A review no tester may take — a tester's own tests — is a developer's that worked neither it nor what it tests.
  const reviews = team.tester && !tester && (started === undefined || started.roles.includes(DEVELOPER));
  const reading = [
    skill(root, 'runs.md'),
    ...(designer ? [skill(root, 'runs-designer.md')] : []),
    // A reviewer's half, not the lead's whole: a tester starts fresh after each piece, and a run's read the lead's 18k
    // characters again each time to use the review it holds.
    ...(tester || reviews ? [skill(root, 'runs-review.md')] : []),
    ...(scout ? [skill(root, 'runs-scout.md')] : []),
    // A role of the project's own says what it does in the skill its team names: the CLI cannot.
    ...(started?.skill === undefined ? [] : [path.join(root, started.skill)])
  ];

  return [
    `You are ${agent}, a ${roles} agent of a Plitzi multi-agent run on the project ${root} (run "${runId}"). The lead is another agent; a person applies the final merge — never you.`,
    '',
    `Read first, whole: ${reading.join(' and ')}${designer ? ' — and, before your first review, what it names to read' : ''}.`,
    '',
    `- The CLI is ${cli} (PLITZI below) — your own: it says who you are on every command, inside a task's copy too, so pass no --token nor --agent. Start with \`cd ${root} && PLITZI task next${started?.quality ? ` --quality ${started.quality}` : ''}\` — it takes your next task, waiting until one is ready, for your roles as the team says them.`,
    ...(scout
      ? [
          `- \`PLITZI task next\` hands you the run's spikes — its scope, the research its stages bring; an agent's question is the lead's. Find out (${reference === undefined ? '`page check`, `page shot`, `page measure`, the code' : `\`page measure …${beside}\`, \`page outline …${beside}\`, \`page shot …${beside} --dress\``}), write nothing of a task's; end every spike with what you found — \`PLITZI task spike <spike> --done "…" [--tasks <stage.json>]\`, the tasks a research spike makes — the lead approves it (with the person, the tasks) before anything is applied. With no spike left, \`task next\` says you can stop.`
        ]
      : [
          "- Work only in the task's copy (the `work` folder its take prints): start with `PLITZI task context` there, and read the files you change yourself.",
          ...(team.tester
            ? [
                '- A task of tests (`<task>-tests`) comes to you only of work you did not write: its tests from what that task was asked — each line of its acceptance, both sides of each condition — never from its code, never bent to pass (a test the work fails, `PLITZI task tell` the lead).'
              ]
            : []),
          reference === undefined
            ? '- Measure, never guess — every element and width in one call: `PLITZI page measure <path> <elements…> --width 390,1440 [--hover <el> | --click <el>]` (a state with the bracket; `PLITZI page outline <path> --within <part>` names them). Trying values, measure; never `task check` for it.'
            : `- Measure, never guess — every element and width in one call: \`PLITZI page measure <path> "<ours> => <theirs>" …${beside} --width 390,1440 [--hover <el> | --click <el>]\` (a state with the bracket; \`PLITZI page outline <path>${beside} --within <part>\` names theirs). Trying values, measure; never \`task check\` for it.`,
          // 17 of 34 checks failed on typecheck or lint — what the project's own scripts say in seconds.
          '- Change a batch, then run the project\'s own `typecheck` and `lint` scripts in your copy (`npm run typecheck`, `npm run lint` — cached, seconds) and fix what they say; then `PLITZI task check` once; then `PLITZI task complete --ease <1-5> --hardest "what cost you the most, and why" [--friction "what of Plitzi got in your way" …] [--helped "…"]` — what it was like, for Plitzi — and `PLITZI task next` again.',
          // T-collection completed with "Known: the phone keeps our inline panel, where the original opens a
          // drawer" — sent back for exactly that.
          `- ${reference === undefined ? 'Something wrong you see' : 'A difference from the site you copy you see'}, inside your task's title, is work, not a note: do it, or \`PLITZI task ask\` the lead before you complete.`,
          // A person following the run read commands where an agent's row should say what it is at.
          '- As what you are at changes in a task of yours, say it in your words — `PLITZI task progress --step "the hero: its title sits 4px low, moving it"`: the person following the run reads it. A review says itself, by its look and its verdict.',
          // Opiniones' arrow moved nothing at 1440, and its developer, its designer and the lead each passed it.
          `- A control you add or change — an arrow, a dot, a pager, a drawer — you use before you complete, there and back, at both widths${reference === undefined ? '' : ", beside the copied site's"}: \`PLITZI page play <path> ${playBeside} --width 390,1440\` — how far each step moved what, what it shows and takes a press; a picture is no proof of one.`
        ]),
    ...(reviews
      ? [
          '- A review may come to you before a task of yours: one no tester may take — a tester\'s own tests — and you worked neither it nor what it tests. `task next` hands it: `PLITZI task look <task>`, then `PLITZI task review <task> --approve | --changes "…"` — what you cannot decide, `PLITZI task review <task> --escalate "…"`.'
        ]
      : []),
    ...(tester
      ? [
          '- `task next` hands you the reviews first — every task\'s QA, as strictly as the lead would: what it was asked, its checks, how it behaves (a control used there and back, both schemes, the phone width), correctness, races, stale state, security, and its tests run (`PLITZI task look <task>`, then `PLITZI task review <task> --approve | --changes "…"`). Your approval is the task\'s; your own tasks another tester or a developer reviews. What you cannot decide is the lead\'s: `PLITZI task review <task> --escalate "…"`. A task of tests the developers cannot write — each worked what it tests — is yours too.'
        ]
      : []),
    ...(designer
      ? [
          `- A review: one \`PLITZI task look <task>\` a round, then measure only what differs, and use each control it adds there and back (\`page play <path> ${playBeside}\`); send it back only for what its title and acceptance cover, with the values${reference === undefined ? '' : ' and one `PLITZI page measure … --same` line that proves them'} — anything else is \`PLITZI run notice "…"\`. Say your verdict within 8 minutes.`
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

/** What the team starts an agent on: its model and its effort, each the harness's own when not said. */
export type HarnessStart = { model?: string; effort?: Effort };

/** The effort as each harness takes it: Codex's highest is `xhigh`, and opencode takes none from the command line. */
const effortFor = (harness: Harness, effort: Effort | undefined): string | undefined =>
  effort === undefined || harness === 'opencode'
    ? undefined
    : harness === 'codex' && effort === 'max'
      ? 'xhigh'
      : effort;

export const harnessCommand = (
  harness: Harness,
  prompt: { file: string; text: string },
  start: HarnessStart = {},
  session?: HarnessSession
): {
  command: string;
  args: string[];
  /** What the harness is started with beside the person's environment: what it would load that a run's agent never needs. */
  env: Record<string, string>;
  line: string;
  model?: string;
  effort?: string;
} => {
  const PROMPT = '\0prompt';
  // The team's model where this harness runs it; else the harness's own default, said by the caller.
  const { model } = start;
  const runs = model !== undefined && harnessRuns(harness, model) ? model : undefined;
  const effort = effortFor(harness, start.effort);
  const parts: string[] =
    harness === 'claude'
      ? [
          'claude',
          '-p',
          PROMPT,
          ...(session ? [session.resume ? '--resume' : '--session-id', session.id] : []),
          ...(runs ? ['--model', runs] : []),
          ...(effort ? ['--effort', effort] : []),
          '--permission-mode',
          'acceptEdits',
          '--allowedTools',
          'Bash Read Edit Write Glob Grep',
          // Only those tools, and none of the person's MCP servers: every tool's definition is read again on every turn —
          // a run's agent started at 46.7k tokens of context with them, 16k without, ~660k of cache over 22 turns.
          '--tools',
          'Bash,Read,Edit,Write,Glob,Grep',
          '--strict-mcp-config'
        ]
      : harness === 'codex'
        ? [
            'codex',
            'exec',
            '--full-auto',
            ...(runs ? ['-m', runs] : []),
            ...(effort ? ['-c', `model_reasoning_effort=${effort}`] : []),
            PROMPT
          ]
        : // No plugin of the person's opencode: the agent's tools are the project's.
          ['opencode', 'run', '--pure', ...(runs ? ['--model', runs] : []), PROMPT];
  // Claude Code's memory of the project, kept outside it: read into every turn (~700 tokens) and written across runs,
  // so one run's agent would carry into the next what nobody reviewed. A run's agent reads the run, not a memory.
  const env: Record<string, string> = harness === 'claude' ? { CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' } : {};
  const line = [
    ...Object.entries(env).map(([name, value]) => `${name}=${value}`),
    ...parts.map(part => (part === PROMPT ? `"$(cat ${prompt.file})"` : quoted(part)))
  ].join(' ');
  const [command = harness, ...args] = parts.map(part => (part === PROMPT ? prompt.text : part));

  return { command, args, env, line, ...(runs ? { model: runs } : {}), ...(effort ? { effort } : {}) };
};
